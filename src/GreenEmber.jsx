import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import { threat } from './threat.js'
import { greenEmber } from './greenEmber.js'
import { shelter } from './shelter.js'
import { ARENA_HALF } from './Player.jsx'

// Step 6.7: the green ember. Where the level waves (Items.jsx) are the safe-ish
// forage, this is the greed play — one at a time, out by the yeti, worth a big
// score bump. Walk into its radius and a sprint runs at the adrenaline speed
// (Player reads greenEmber.boost: 10 -> ~11), just fast enough to beat the
// yeti's close-range lunge on the way back out. Grab it for the points; clear
// the yeti's range before the escape window closes for a second bonus.
//
// The whole risk is that it sits with the yeti, so it stays there: rather than
// spawning once and going stale, it slowly trails the yeti at a fixed offset
// (slower than you can run, so it's still catchable). During a long chase it
// falls behind him and drifts; when he settles back to a wander it catches up.
// A hard leash blinks it back if it ever lags too far. The interlude despawns
// it — no camping it through the breather — and it re-appears next to him a
// little way into the next level.
//
// Beacon: the arena is 120u across and the fog shuts at 70u, so it carries a
// soft fog-immune shaft of light that reads through the murk and brightens a
// little with distance — enough to point you at "the yeti and the prize" from
// range without turning into an arcade objective marker.
//
// Self-contained: no physics, a plain distance check each frame; only the
// spawn / despawn re-renders, the follow motion is all refs.
const PICKUP_RADIUS = 2.2
const ADRENALINE_RADIUS = 13 // step inside this and a sprint runs at boost speed
const HOVER_HEIGHT = 1.0

const FIRST_SPAWN = 14 // seconds into a run before the first one shows
const RESPAWN_DELAY = 24 // seconds of quiet after a grab before the next
const AFTER_INTERLUDE_DELAY = 8 // re-appears this long into the next level
const APPEAR_TIME = 1.0 // fade / scale-in so a spawn or a leash-snap doesn't pop

const ESCAPE_WINDOW = 6 // seconds the boost lingers / the getaway bonus is live
const ESCAPE_CLEAR_DIST = 32 // get this far from the yeti in the window -> bonus

const OFFSET_MIN = 6 // the ember trails the yeti somewhere in this range
const OFFSET_MAX = 11
const OFFSET_HOLD_MIN = 5 // seconds before the trailing offset is re-rolled
const OFFSET_HOLD_VAR = 3
const FOLLOW_SPEED = 4 // m/s the ember drifts toward its offset from the yeti
const LEASH_MAX = 22 // lagged further than this -> blink back near the yeti
const PLAYER_CLEAR = 14 // don't drop it right on the player; flip to the far side

// Roll a fresh trailing offset (a THREE.Vector2 in x/z).
function rollOffset(out) {
  const ang = Math.random() * Math.PI * 2
  const r = OFFSET_MIN + Math.random() * (OFFSET_MAX - OFFSET_MIN)
  out.set(Math.sin(ang) * r, Math.cos(ang) * r)
}

export default function GreenEmber() {
  const { camera } = useThree()
  const root = useRef()
  const orb = useRef()
  const light = useRef()
  const glow = useRef()
  const beam = useRef()

  const phase = useRef('waiting') // 'waiting' = counting to spawn, 'active' = out there
  const respawn = useRef(FIRST_SPAWN)
  const age = useRef(0) // seconds since this ember (re)appeared — drives the fade-in
  const pos = useRef(new THREE.Vector3())
  const offset = useRef(new THREE.Vector2())
  const offsetHold = useRef(0)
  const esc = useRef({ timer: 0, done: false })
  // `active` mounts the group; `spawnAt` seeds its position for the first frame,
  // after which the follow motion mutates root.current.position directly.
  const [active, setActive] = useState(false)
  const [spawnAt, setSpawnAt] = useState([0, 0])

  // greenEmber is a module singleton, so make sure a fresh run starts unboosted.
  useEffect(() => {
    greenEmber.boost = false
    return () => {
      greenEmber.boost = false
    }
  }, [])

  // Place the ember at the yeti + a fresh offset, nudged off the player and the
  // arena wall. Seeds pos.current and resets the fade-in.
  const placeNearYeti = () => {
    const edge = ARENA_HALF - 3
    rollOffset(offset.current)
    let x = threat.yetiX + offset.current.x
    let z = threat.yetiZ + offset.current.y
    if (Math.hypot(x - camera.position.x, z - camera.position.z) < PLAYER_CLEAR) {
      offset.current.negate()
      x = threat.yetiX + offset.current.x
      z = threat.yetiZ + offset.current.y
    }
    const cx = THREE.MathUtils.clamp(x, -edge, edge)
    const cz = THREE.MathUtils.clamp(z, -edge, edge)
    pos.current.set(cx, HOVER_HEIGHT, cz)
    offsetHold.current = OFFSET_HOLD_MIN + Math.random() * OFFSET_HOLD_VAR
    age.current = 0
    return [cx, cz]
  }

  useFrame((_, rawDelta) => {
    const { status, interlude } = useGame.getState()
    if (status !== 'playing') {
      greenEmber.boost = false
      return
    }
    const delta = Math.min(rawDelta, 0.1)

    // Escape window: runs down independently of the ember's phase. While it's
    // open the adrenaline sprint stays available, and clearing the yeti's range
    // pays the getaway bonus once.
    if (esc.current.timer > 0) {
      esc.current.timer -= delta
      if (!esc.current.done && !interlude && threat.distance > ESCAPE_CLEAR_DIST) {
        esc.current.done = true
        useGame.getState().greenEscape()
      }
    }

    // The interlude is a real breather. Freeze the spawn clock, drop the boost,
    // and pull any live ember so it can't be camped through the breather and
    // grabbed for free the moment the next wave re-aggros.
    if (interlude) {
      if (phase.current === 'active') {
        phase.current = 'waiting'
        respawn.current = AFTER_INTERLUDE_DELAY
        setActive(false)
      }
      greenEmber.boost = false
      return
    }

    if (phase.current === 'waiting') {
      greenEmber.boost = esc.current.timer > 0
      respawn.current -= delta
      if (respawn.current <= 0 && Number.isFinite(threat.yetiX)) {
        setSpawnAt(placeNearYeti())
        phase.current = 'active'
        setActive(true)
      }
      return
    }

    // --- phase 'active' ---
    if (!root.current) {
      // state lag: phase flipped, the group isn't mounted yet — next frame.
      greenEmber.boost = esc.current.timer > 0
      return
    }
    age.current += delta

    // Drift toward the yeti + current offset, re-rolling the offset now and then
    // so it isn't always trailing off the same shoulder. Blink back if a chase
    // has dragged the yeti so far that the ember's been left in the fog.
    offsetHold.current -= delta
    if (offsetHold.current <= 0) {
      rollOffset(offset.current)
      offsetHold.current = OFFSET_HOLD_MIN + Math.random() * OFFSET_HOLD_VAR
    }
    const edge = ARENA_HALF - 3
    const tx = THREE.MathUtils.clamp(threat.yetiX + offset.current.x, -edge, edge)
    const tz = THREE.MathUtils.clamp(threat.yetiZ + offset.current.y, -edge, edge)
    const gx = tx - pos.current.x
    const gz = tz - pos.current.z
    const gap = Math.hypot(gx, gz)
    if (gap > LEASH_MAX) {
      pos.current.set(tx, HOVER_HEIGHT, tz)
      age.current = 0 // fade the blink back in
    } else if (gap > FOLLOW_SPEED * delta) {
      pos.current.x += (gx / gap) * FOLLOW_SPEED * delta
      pos.current.z += (gz / gap) * FOLLOW_SPEED * delta
    } else {
      pos.current.x = tx
      pos.current.z = tz
    }
    root.current.position.x = pos.current.x
    root.current.position.z = pos.current.z

    const pdx = camera.position.x - pos.current.x
    const pdz = camera.position.z - pos.current.z
    const pdist2 = pdx * pdx + pdz * pdz

    // 6.12: no reaching the green ember from inside a shed — it's a risk play,
    // and a wall between you and the yeti takes the risk out of it. The ember
    // just trails him past your door; you have to come out for it.
    const reachable = !shelter.inside

    greenEmber.boost =
      (reachable && pdist2 < ADRENALINE_RADIUS * ADRENALINE_RADIUS) ||
      esc.current.timer > 0

    // Bob / spin, fade-in, gentle pulse, and a mild distance brighten so the
    // shaft still points you at it from across the arena.
    const t = performance.now() * 0.002
    const appear = THREE.MathUtils.clamp(age.current / APPEAR_TIME, 0, 1)
    const pulse = 0.85 + Math.sin(t * 2.2) * 0.15
    const far = THREE.MathUtils.clamp((Math.sqrt(pdist2) - 20) / 55, 0, 1)

    const g = orb.current
    if (g) {
      g.rotation.y += delta * 1.4
      g.position.y = Math.sin(t) * 0.18 // bob; the parent group holds HOVER_HEIGHT
      g.scale.setScalar(0.4 + appear * 0.6)
    }
    if (light.current) light.current.intensity = 11 * pulse * appear
    if (glow.current) glow.current.material.opacity = (0.14 + far * 0.14) * pulse * appear
    if (beam.current) beam.current.material.opacity = (0.08 + far * 0.16) * pulse * appear

    if (reachable && pdist2 < PICKUP_RADIUS * PICKUP_RADIUS) {
      useGame.getState().collectGreenEmber()
      esc.current = { timer: ESCAPE_WINDOW, done: false }
      respawn.current = RESPAWN_DELAY
      phase.current = 'waiting'
      setActive(false)
    }
  })

  if (!active) return null
  return (
    <group ref={root} position={[spawnAt[0], HOVER_HEIGHT, spawnAt[1]]}>
      {/* Soft fog-immune shaft — the part you can pick out from across the
          arena. Additive, no depth write, no fog; opacity driven per-frame. */}
      <mesh ref={beam} position={[0, 8, 0]}>
        <cylinderGeometry args={[0.28, 0.55, 16, 8, 1, true]} />
        <meshBasicMaterial
          color="#3dffa0"
          transparent
          opacity={0.1}
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group ref={orb}>
        <mesh castShadow>
          <icosahedronGeometry args={[0.46, 0]} />
          <meshStandardMaterial
            color="#a9ffcf"
            emissive="#25ff8f"
            emissiveIntensity={2.6}
            roughness={0.3}
            flatShading
          />
        </mesh>
        <mesh ref={glow}>
          <sphereGeometry args={[1.2, 14, 14]} />
          <meshBasicMaterial
            color="#3dffa0"
            transparent
            opacity={0.14}
            depthWrite={false}
            fog={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      <pointLight color="#41ffa6" intensity={11} distance={20} decay={2} ref={light} />
    </group>
  )
}
