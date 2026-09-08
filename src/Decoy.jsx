import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import { threat } from './threat.js'
import { greenEmber } from './greenEmber.js'
import { decoy, resetDecoy } from './decoy.js'
import { generateTrees, resolveTreeCollision } from './trees.js'
import { generateSheds, resolveShedCollision } from './sheds.js'
import { inControl } from './touch.js'
import { hasFreeSlot } from './inventory.js'
import { ARENA_HALF } from './arena.js'

// Step 6.14: the decoy — a throwable that hard-resets a chase. Two halves:
//
//  - the pickup (DecoyPickup): one at a time, on a long fuse, dropped in the
//    danger zone out by the green ember (falling back to the yeti's own
//    position when no ember is out — the ember only ever trails him anyway).
//    So the risky green-ember grab doubles as restocking your one panic button.
//    Carried one at a time; the fuse holds while you've got one in hand.
//
//  - the throw (this component): press F and the decoy arcs out ahead of you,
//    lands, and the yeti breaks off whatever he's doing — a live chase
//    included — to go investigate it (decoy.js publishes the landing spot;
//    Yeti.jsx reads it and runs the 6.11 probe against it). Cut away while he's
//    still committed to the walk over and you've shaken him.
//
// Pure singletons + refs, same as the green ember: only the pickup's spawn and
// the thrown bundle's mount/unmount re-render; the motion is all imperative.

// --- pickup ---
const PICKUP_RADIUS = 2.8
const HOVER_HEIGHT = 1.0
// Rare, but a run should actually see one. The fuse only ticks once a green
// ember is out (that's what it spawns beside), so the real wait is longer than
// these numbers — first green ember is ~14s in, and they come and go.
const FIRST_SPAWN = 16
const RESPAWN = 50
// It clusters right in with the green ember's beacon — grab one, grab the
// other, same dash into the danger zone.
const SPAWN_OFFSET_MIN = 2
const SPAWN_OFFSET_MAX = 6
// Keep it just inside the arena wall, like the green ember (its beacon punches
// through the mountain ring the same way, so it doesn't need Consumables'
// deeper margin).
const SPAWN_MAX_RADIUS = ARENA_HALF - 4
// Sat unclaimed this long and forgotten (player well past the fog) — quietly
// re-roll it back near the current danger.
const RELOCATE_AFTER = 34
const RELOCATE_MIN_DIST = 62

// --- throw ---
const THROW_DIST = 17 // how far ahead of you it lands (before clamps)
const ARC_HEIGHT = 3.0
const FLIGHT_TIME = 0.52 // seconds in the air
const HAND_HEIGHT = 1.4 // where it leaves your hand, roughly
const GROUND_Y = 0.5 // resting height once it lands
const MAX_GROUND_TIME = 9 // force-clear decoy.live if the yeti never reaches it
const FADE_TIME = 0.5 // fade / shrink once it's spent

const VIOLET = '#b98dff'

// A point SPAWN_OFFSET_* out from (ox, oz), nudged clear of trunks and shed
// walls and pulled inside the mountain ring.
function rollSpotAround(ox, oz, trees, sheds, hit) {
  const ang = Math.random() * Math.PI * 2
  const rad = SPAWN_OFFSET_MIN + Math.random() * (SPAWN_OFFSET_MAX - SPAWN_OFFSET_MIN)
  const x = ox + Math.sin(ang) * rad
  const z = oz + Math.cos(ang) * rad
  resolveTreeCollision(trees, x, z, 0.6, hit)
  resolveShedCollision(sheds, hit.x, hit.z, 0.6, hit)
  const r = Math.hypot(hit.x, hit.z)
  if (r > SPAWN_MAX_RADIUS) {
    const k = SPAWN_MAX_RADIUS / r
    return [hit.x * k, hit.z * k]
  }
  return [hit.x, hit.z]
}

// Where to drop it. `requireEmber` (the initial spawn) waits for a green ember
// so the decoy always lands beside that beacon; the relocate rescue takes the
// yeti as a fallback so a forgotten one still gets pulled back into play.
function dangerPoint(requireEmber) {
  if (greenEmber.present) return [greenEmber.x, greenEmber.z]
  if (requireEmber) return null
  if (Number.isFinite(threat.yetiX)) return [threat.yetiX, threat.yetiZ]
  return null
}

function DecoyPickup({ trees, sheds }) {
  const { camera } = useThree()
  const mesh = useRef()
  const glow = useRef()
  const beam = useRef()
  const light = useRef()
  const hit = useMemo(() => ({ x: 0, z: 0 }), [])

  const phase = useRef('waiting')
  const fuse = useRef(FIRST_SPAWN)
  const age = useRef(0)
  const [spot, setSpot] = useState(null)

  useFrame((_, rawDelta) => {
    const { status, interlude, isTouch, slots } = useGame.getState()
    if (status !== 'playing') return
    const delta = Math.min(rawDelta, 0.1)
    const carryingDecoy = slots.includes('decoy')

    if (phase.current === 'waiting') {
      // Don't burn the fuse on the start prompt / a pause, or while one's
      // already in a slot — you don't need a second panic button.
      if (!inControl(isTouch) || carryingDecoy) return
      fuse.current -= delta
      if (fuse.current <= 0) {
        // Fuse is spent — but hold here until a green ember is out to spawn
        // beside. It fires the frame one appears.
        const d = dangerPoint(true)
        if (!d) return
        setSpot(rollSpotAround(d[0], d[1], trees, sheds, hit))
        age.current = 0
        phase.current = 'active'
      }
      return
    }

    // --- active ---
    if (!spot) return
    age.current += delta

    const dx = camera.position.x - spot[0]
    const dz = camera.position.z - spot[1]
    const pdist = Math.hypot(dx, dz)

    // Stranded and forgotten — pull it back to wherever the danger moved to.
    if (age.current > RELOCATE_AFTER && pdist > RELOCATE_MIN_DIST) {
      const d = dangerPoint(false)
      if (d) {
        setSpot(rollSpotAround(d[0], d[1], trees, sheds, hit))
        age.current = 0
      }
      return
    }

    const t = performance.now() * 0.002
    const g = mesh.current
    if (g) {
      g.rotation.y += delta * 1.3
      g.rotation.z = Math.sin(t * 0.8) * 0.25
      g.position.y = HOVER_HEIGHT + Math.sin(t + 0.7) * 0.12
    }
    // Read like the green ember's beacon — bright, pulsing, brighter still with
    // distance so it carries through the fog from across the arena.
    const far = THREE.MathUtils.clamp((pdist - 16) / 46, 0, 1)
    const pulse = 0.82 + Math.sin(t * 2.6) * 0.18
    if (light.current) {
      light.current.intensity = (12 + far * 10) * pulse
      light.current.distance = 18 + far * 8
    }
    if (glow.current) glow.current.material.opacity = (0.24 + far * 0.24) * pulse
    if (beam.current) beam.current.material.opacity = (0.12 + far * 0.2) * pulse

    if (pdist * pdist > PICKUP_RADIUS * PICKUP_RADIUS) return
    // In range: take it if a slot's free and we're not already holding one.
    if (carryingDecoy || interlude || !hasFreeSlot(slots)) return
    useGame.getState().grabItem('decoy')
    phase.current = 'waiting'
    fuse.current = RESPAWN
    setSpot(null)
  })

  if (!spot) return null
  return (
    <group ref={mesh} position={[spot[0], HOVER_HEIGHT, spot[1]]}>
      {/* a wrapped stick-bundle — a stubby cross of two boxes */}
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.18, 0.18]} />
        <meshStandardMaterial
          color={VIOLET}
          emissive="#7b4fe0"
          emissiveIntensity={2.2}
          roughness={0.6}
          flatShading
        />
      </mesh>
      <mesh castShadow rotation={[0, 0, Math.PI / 2.6]}>
        <boxGeometry args={[0.52, 0.16, 0.16]} />
        <meshStandardMaterial
          color="#a074f0"
          emissive="#6338c8"
          emissiveIntensity={1.9}
          roughness={0.7}
          flatShading
        />
      </mesh>
      <mesh ref={glow}>
        <sphereGeometry args={[1.1, 14, 14]} />
        <meshBasicMaterial
          color="#caa9ff"
          transparent
          opacity={0.24}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* fog-immune shaft so it reads from range, like the ember beacons */}
      <mesh ref={beam} position={[0, 8, 0]}>
        <cylinderGeometry args={[0.26, 0.5, 16, 8, 1, true]} />
        <meshBasicMaterial
          color="#caa9ff"
          transparent
          opacity={0.12}
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight ref={light} color="#b48bff" intensity={12} distance={18} decay={2} />
    </group>
  )
}

export default function Decoy() {
  const { camera } = useThree()
  const trees = useMemo(() => generateTrees(), [])
  const sheds = useMemo(() => generateSheds(), [])

  const root = useRef()
  const orb = useRef()
  const light = useRef()
  // The in-flight / on-ground bundle. null when nothing's been thrown (or the
  // last one has faded out).
  const fly = useRef(null)
  // `visible` mounts the bundle; `origin` seeds its position for the very first
  // frame (before useFrame takes over the motion) so it never blips at (0,0,0).
  const [visible, setVisible] = useState(false)
  const [origin, setOrigin] = useState([0, 0])

  // decoy is a module singleton — clear it for a fresh run.
  useEffect(() => {
    resetDecoy()
    return () => resetDecoy()
  }, [])

  // The throw fires here (not App.jsx) because the arc needs the camera heading,
  // which only lives inside the Canvas. 7.4 routes it through the store: using a
  // slot that holds a decoy clears the slot and bumps `throwReq`; this
  // subscription catches that edge and flings from wherever the camera is. The
  // "can I throw" gate (playing, one in hand, not mid-interlude) is already
  // spent in useSlot, so all that's left is the geometry.
  useEffect(() => {
    let seen = useGame.getState().throwReq
    return useGame.subscribe((s) => {
      if (s.throwReq === seen) return
      seen = s.throwReq
      if (s.status !== 'playing') return

      // Flatten the camera heading onto the ground and throw that way.
      const fwd = new THREE.Vector3()
      camera.getWorldDirection(fwd)
      fwd.y = 0
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
      fwd.normalize()

      let x = camera.position.x + fwd.x * THROW_DIST
      let z = camera.position.z + fwd.z * THROW_DIST
      const hit = { x: 0, z: 0 }
      resolveTreeCollision(trees, x, z, 0.5, hit)
      resolveShedCollision(sheds, hit.x, hit.z, 0.5, hit)
      x = THREE.MathUtils.clamp(hit.x, -(ARENA_HALF - 3), ARENA_HALF - 3)
      z = THREE.MathUtils.clamp(hit.z, -(ARENA_HALF - 3), ARENA_HALF - 3)

      fly.current = {
        stage: 'flying',
        t: 0,
        fromX: camera.position.x,
        fromZ: camera.position.z,
        toX: x,
        toZ: z,
        ground: 0, // set to MAX_GROUND_TIME on landing
        fade: 1,
      }
      setOrigin([camera.position.x, camera.position.z])
      setVisible(true)

      decoy.x = x
      decoy.z = z
      decoy.throwId += 1
      decoy.live = true
    })
  }, [camera, trees, sheds])

  useFrame((_, rawDelta) => {
    const f = fly.current
    if (!f || !root.current) return
    const { status } = useGame.getState()
    if (status !== 'playing') return
    const delta = Math.min(rawDelta, 0.1)

    if (f.stage === 'flying') {
      f.t += delta / FLIGHT_TIME
      const k = Math.min(f.t, 1)
      root.current.position.x = THREE.MathUtils.lerp(f.fromX, f.toX, k)
      root.current.position.z = THREE.MathUtils.lerp(f.fromZ, f.toZ, k)
      root.current.position.y =
        THREE.MathUtils.lerp(HAND_HEIGHT, GROUND_Y, k) + Math.sin(k * Math.PI) * ARC_HEIGHT
      if (f.t >= 1) {
        f.stage = 'resting'
        f.ground = MAX_GROUND_TIME
        root.current.position.set(f.toX, GROUND_Y, f.toZ)
      }
    } else if (f.stage === 'resting') {
      f.ground -= delta
      // The yeti finishing with it (decoy.live back to false) or the safety
      // timer running out both end it — start the fade either way.
      if (!decoy.live || f.ground <= 0) {
        decoy.live = false
        f.stage = 'fading'
      }
    } else {
      // fading
      f.fade -= delta / FADE_TIME
      if (f.fade <= 0) {
        fly.current = null
        setVisible(false)
        return
      }
    }

    // spin the bundle the whole time; pulse + bob the glow while it's on the
    // ground so you can see where it landed and read that he's going for it.
    const t = performance.now() * 0.003
    if (orb.current) {
      orb.current.rotation.x += delta * 6
      orb.current.rotation.y += delta * 4
      orb.current.position.y =
        f.stage === 'resting' ? Math.sin(t * 1.6) * 0.12 : 0
    }
    const rest = f.stage === 'resting' ? 1 : f.stage === 'fading' ? Math.max(0, f.fade) : 0.5
    const pulse = 0.75 + Math.sin(t * 2.6) * 0.25
    if (light.current) light.current.intensity = 11 * rest * pulse
    root.current.scale.setScalar(f.stage === 'fading' ? Math.max(0.001, f.fade) : 1)
  })

  return (
    <>
      <DecoyPickup trees={trees} sheds={sheds} />
      {visible && (
        <group ref={root} position={[origin[0], HAND_HEIGHT, origin[1]]}>
          <group ref={orb}>
            <mesh castShadow>
              <boxGeometry args={[0.6, 0.16, 0.16]} />
              <meshStandardMaterial
                color={VIOLET}
                emissive="#5a3bb0"
                emissiveIntensity={1.4}
                roughness={0.7}
                flatShading
              />
            </mesh>
            <mesh castShadow rotation={[0, 0, Math.PI / 2.6]}>
              <boxGeometry args={[0.5, 0.14, 0.14]} />
              <meshStandardMaterial
                color="#a074f0"
                emissive="#472c95"
                emissiveIntensity={1.2}
                roughness={0.8}
                flatShading
              />
            </mesh>
          </group>
          <mesh>
            <sphereGeometry args={[1.0, 14, 14]} />
            <meshBasicMaterial
              color="#caa9ff"
              transparent
              opacity={0.2}
              depthWrite={false}
              fog={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <pointLight ref={light} color="#b48bff" intensity={11} distance={18} decay={2} />
        </group>
      )}
    </>
  )
}
