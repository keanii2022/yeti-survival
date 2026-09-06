import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import { threat } from './threat.js'
import { ARENA_HALF } from './Player.jsx'
import { createProbe, beginProbe, stepProbe } from './investigate.js'

// Step 3: one yeti with basic chase-detection AI.
// Step 6.2: spawn point and idle wander are randomized per run.
// Step 6.11: a 'search' state sits between chase and idle — the yeti has a memory.
//
// Each run the yeti spawns somewhere random in the arena, always far enough
// from the player's start that no run begins already in a chase. It idles by
// roaming the whole arena on random waypoints until the player comes within
// DETECT_RADIUS. Then it locks on and walks straight at them until it gets
// within CATCH_RADIUS — which ends the run.
//
// Losing the player past LOSE_RADIUS (a bigger ring, so the state doesn't
// flicker at the boundary) no longer resets it straight to wander. Instead it
// drops into 'search': it stalks to the spot where it last saw you and casts
// around there for a few seconds (see investigate.js) before finally giving up.
// So a straight sprint away just leads it to your trail — to actually shake it
// you have to break line of sight, change direction, and stay unseen through
// the whole search (SEARCH_TIME plus however long the stalk takes).
//
// No pathfinding and no trees-as-cover yet; that's later in the build order.
// These numbers are tuned by feel, not physics: the chase is a touch slower
// than a walk (Player WALK_SPEED = 6) so backing away buys you a little time,
// but a sprint (10) clearly pulls ahead — until it gets within BURST_RADIUS,
// where it lunges at CHASE_BURST_SPEED (7). That's faster than a walk and
// independent of the player's stamina, so being cornered close is always deadly.
//
// 6.10 grew the arena to 120x120 but left these two where they were on purpose:
// a fixed-size sight range in a much larger pen is exactly what lets a chase be
// broken by ducking into the fog. Wander points are still arena-wide, so the
// yeti now genuinely leaves whole regions unpatrolled.
const DETECT_RADIUS = 18
const LOSE_RADIUS = 24 // break past this to drop the chase; still 6u of hysteresis
// Once you've broken a chase the yeti is only searching, not tracking — it has
// to get well inside detection range to re-spot you, so a shaken chase stays
// shaken unless it nearly walks into you.
const REACQUIRE_RADIUS = 14
const CATCH_RADIUS = 1.9
const CHASE_SPEED = 5.4
const CHASE_BURST_SPEED = 7
const BURST_RADIUS = 6
const WANDER_SPEED = 1.6
const TURN_RATE = 2.6 // radians/sec the yeti can rotate toward its heading

// Seconds the yeti hunts your last-known spot before it gives up and wanders
// off. Floor of the "stay unseen ~4-6 s to shake him" window from the build
// plan; the stalk to that spot stacks on top. 6.6 scales this up with the level.
const SEARCH_TIME = 4

const PLAYER_SPAWN = new THREE.Vector2(0, 8) // camera start (x, z) — see App.jsx
const EDGE_MARGIN = 2 // keep spawns and waypoints off the arena wall
// The yeti spawns in a ring around the player: past SPAWN_MIN_DIST so no run
// starts already in detection range, but inside SPAWN_MAX_DIST — only a short
// closing walk outside detection — so the first encounter comes quickly instead
// of you hiking across the 120x120 arena to find it.
const SPAWN_MIN_DIST = DETECT_RADIUS + 5
const SPAWN_MAX_DIST = DETECT_RADIUS + 16

// A point somewhere inside the arena, at least EDGE_MARGIN off every wall.
function randomArenaPoint(out) {
  const limit = ARENA_HALF - EDGE_MARGIN
  return out.set(
    (Math.random() * 2 - 1) * limit,
    0,
    (Math.random() * 2 - 1) * limit,
  )
}

// A fresh spawn each run: a random arena point in the ring SPAWN_MIN_DIST..
// SPAWN_MAX_DIST from the player start.
function randomSpawn() {
  const p = new THREE.Vector3()
  for (let i = 0; i < 60; i++) {
    randomArenaPoint(p)
    const dx = p.x - PLAYER_SPAWN.x
    const dz = p.z - PLAYER_SPAWN.y
    const d2 = dx * dx + dz * dz
    if (d2 > SPAWN_MIN_DIST * SPAWN_MIN_DIST && d2 < SPAWN_MAX_DIST * SPAWN_MAX_DIST) break
  }
  return [p.x, 0, p.z]
}

// A shaggy white brute, built from primitives to match the tree style. Stands
// ~2.6m — taller than the player's 1.7m eye height, so it reads as looming.
// Modelled facing +Z so `rotation.y = atan2(dx, dz)` aims it at a target.
function YetiModel({ eyeRef }) {
  return (
    <group>
      {/* legs */}
      <mesh position={[-0.45, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 1.4, 6]} />
        <meshStandardMaterial color="#e9eef2" roughness={1} />
      </mesh>
      <mesh position={[0.45, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 1.4, 6]} />
        <meshStandardMaterial color="#e9eef2" roughness={1} />
      </mesh>

      {/* torso */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <capsuleGeometry args={[0.85, 1.1, 4, 10]} />
        <meshStandardMaterial color="#f2f6fa" roughness={1} />
      </mesh>

      {/* arms, hanging slightly forward */}
      <mesh position={[-1.0, 1.8, 0.15]} rotation={[0.3, 0, 0.15]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 1.5, 6]} />
        <meshStandardMaterial color="#e4eaef" roughness={1} />
      </mesh>
      <mesh position={[1.0, 1.8, 0.15]} rotation={[0.3, 0, -0.15]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 1.5, 6]} />
        <meshStandardMaterial color="#e4eaef" roughness={1} />
      </mesh>

      {/* head */}
      <mesh position={[0, 2.75, 0.05]} castShadow>
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#f6f9fc" roughness={1} flatShading />
      </mesh>

      {/* eyes — emissive so they can glow brighter the instant it spots you */}
      <mesh position={[-0.2, 2.82, 0.5]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial
          ref={(m) => (eyeRef.current[0] = m)}
          color="#2a0000"
          emissive="#ff2a1a"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0.2, 2.82, 0.5]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial
          ref={(m) => (eyeRef.current[1] = m)}
          color="#2a0000"
          emissive="#ff2a1a"
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  )
}

export default function Yeti() {
  const group = useRef()
  const { camera } = useThree()

  // Rolled once per mount; the scene remounts on every run (App keys on runId),
  // so this re-randomizes each time.
  const spawn = useMemo(() => randomSpawn(), [])

  // Per-frame state kept off React so the chase loop never triggers a re-render.
  const ai = useRef({
    mode: 'idle', // 'idle' | 'chase' | 'search'
    heading: 0, // yaw the yeti is turning toward, radians
    wander: new THREE.Vector3(spawn[0], 0, spawn[2]), // current idle target
    wanderTimer: 0,
    lastKnown: new THREE.Vector3(), // where the player was last seen (for 'search')
    probe: createProbe(), // drives the walk-to-a-spot-and-look-around motion
  })
  const eyeRef = useRef([null, null])

  // Reused every frame so the chase loop allocates nothing.
  const scratch = useMemo(
    () => ({
      toPlayer: new THREE.Vector3(),
      toWander: new THREE.Vector3(),
      dir: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((_, rawDelta) => {
    const g = group.current
    if (!g) return

    // Freeze completely once the run is over.
    if (useGame.getState().status !== 'playing') return

    const delta = Math.min(rawDelta, 0.1) // guard against tab-switch time jumps
    const a = ai.current
    const { toPlayer, toWander, dir } = scratch

    // Horizontal vector from yeti to player.
    toPlayer.set(
      camera.position.x - g.position.x,
      0,
      camera.position.z - g.position.z,
    )
    const dist = toPlayer.length()

    // --- detection state machine (with hysteresis) ---
    // Keep the last-known fix current for as long as it can actually see you.
    if (a.mode === 'chase') a.lastKnown.set(camera.position.x, 0, camera.position.z)

    if (a.mode === 'idle' && dist < DETECT_RADIUS) {
      a.mode = 'chase'
    } else if (a.mode === 'chase' && dist > LOSE_RADIUS) {
      // Lost sight — don't reset yet. Go hunt where they were last seen.
      beginProbe(a.probe, a.lastKnown.x, a.lastKnown.z, SEARCH_TIME)
      a.mode = 'search'
    } else if (a.mode === 'search' && dist < REACQUIRE_RADIUS) {
      a.probe.active = false // reacquired — straight back to the chase
      a.mode = 'chase'
    }

    // Publish the readout the audio engine / vignette poll each frame.
    threat.distance = dist
    threat.mode = a.mode

    // --- caught? ---
    if (dist < CATCH_RADIUS) {
      useGame.getState().catchPlayer()
      return
    }

    // --- pick a movement direction for this frame (unit vector in `dir`) ---
    let moving = false
    let speed = 0

    if (a.mode === 'chase') {
      dir.copy(toPlayer).normalize()
      speed = dist < BURST_RADIUS ? CHASE_BURST_SPEED : CHASE_SPEED
      moving = true
    } else if (a.mode === 'search') {
      // Stalk to the last-known spot, cast around it, then give up — see
      // investigate.js. Keep the pokes off the arena wall like the waypoints.
      const r = stepProbe(a.probe, g.position, delta, { bound: ARENA_HALF - EDGE_MARGIN })
      if (r.done) {
        a.mode = 'idle'
        a.wanderTimer = 0 // pick a fresh waypoint next frame
      } else {
        dir.set(r.aimX - g.position.x, 0, r.aimZ - g.position.z)
        if (dir.lengthSq() > 1e-6) {
          dir.normalize()
          speed = r.speed
          moving = true
        }
      }
    } else {
      // Idle wander: amble toward a waypoint anywhere in the arena, refreshing
      // it on arrival or every several seconds. Points are arena-wide now, so
      // the yeti roams the whole map instead of orbiting its spawn.
      a.wanderTimer -= delta
      toWander.set(a.wander.x - g.position.x, 0, a.wander.z - g.position.z)
      if (a.wanderTimer <= 0 || toWander.length() < 0.6) {
        randomArenaPoint(a.wander)
        a.wanderTimer = 5 + Math.random() * 4
      } else {
        dir.copy(toWander).normalize()
        speed = WANDER_SPEED
        moving = true
      }
    }

    // --- turn toward the direction, then step forward ---
    if (moving) {
      a.heading = Math.atan2(dir.x, dir.z)
      g.position.addScaledVector(dir, speed * delta)
      g.position.x = THREE.MathUtils.clamp(g.position.x, -ARENA_HALF, ARENA_HALF)
      g.position.z = THREE.MathUtils.clamp(g.position.z, -ARENA_HALF, ARENA_HALF)
    }

    // Smoothly rotate the body toward the heading (shortest angular path).
    let diff = a.heading - g.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    const maxTurn = TURN_RATE * delta
    g.rotation.y += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn)

    // Menacing bob while moving; eyes flare when locked on.
    g.position.y = moving ? Math.abs(Math.sin(performance.now() * 0.006)) * 0.12 : 0
    const glow = a.mode === 'chase' ? 1.6 : a.mode === 'search' ? 0.7 : 0.15
    for (const m of eyeRef.current) {
      if (m) m.emissiveIntensity += (glow - m.emissiveIntensity) * Math.min(delta * 6, 1)
    }
  })

  return (
    <group ref={group} position={spawn}>
      <YetiModel eyeRef={eyeRef} />
    </group>
  )
}
