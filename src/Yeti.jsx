import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import { threat } from './threat.js'
import { ARENA_HALF } from './Player.jsx'

// Step 3: one yeti with basic chase-detection AI.
// Step 6.2: spawn point and idle wander are randomized per run.
//
// Each run the yeti spawns somewhere random in the arena, always far enough
// from the player's start that no run begins already in a chase. It idles by
// roaming the whole arena on random waypoints until the player comes within
// DETECT_RADIUS. Then it locks on and walks straight at them until either it
// loses them past LOSE_RADIUS (a bigger ring, so the state doesn't flicker at
// the boundary) or it gets within CATCH_RADIUS — which ends the run.
//
// No pathfinding and no trees-as-cover yet; that's later in the build order.
// These numbers are tuned by feel, not physics: the chase is a touch slower
// than a walk (Player WALK_SPEED = 6) so backing away buys you a little time,
// but a sprint (10) clearly pulls ahead — until it gets within BURST_RADIUS,
// where it lunges at CHASE_BURST_SPEED (7). That's faster than a walk and
// independent of the player's stamina, so being cornered close is always deadly.
const DETECT_RADIUS = 18
const LOSE_RADIUS = 27
const CATCH_RADIUS = 1.9
const CHASE_SPEED = 5.4
const CHASE_BURST_SPEED = 7
const BURST_RADIUS = 6
const WANDER_SPEED = 1.6
const TURN_RATE = 2.6 // radians/sec the yeti can rotate toward its heading

const PLAYER_SPAWN = new THREE.Vector2(0, 8) // camera start (x, z) — see App.jsx
const EDGE_MARGIN = 2 // keep spawns and waypoints off the arena wall
const SPAWN_MIN_DIST = DETECT_RADIUS + 5 // no run starts inside detection range

// A point somewhere inside the arena, at least EDGE_MARGIN off every wall.
function randomArenaPoint(out) {
  const limit = ARENA_HALF - EDGE_MARGIN
  return out.set(
    (Math.random() * 2 - 1) * limit,
    0,
    (Math.random() * 2 - 1) * limit,
  )
}

// A fresh spawn each run: a random arena point kept clear of the player start.
function randomSpawn() {
  const p = new THREE.Vector3()
  for (let i = 0; i < 40; i++) {
    randomArenaPoint(p)
    const dx = p.x - PLAYER_SPAWN.x
    const dz = p.z - PLAYER_SPAWN.y
    if (dx * dx + dz * dz > SPAWN_MIN_DIST * SPAWN_MIN_DIST) break
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
    mode: 'idle', // 'idle' | 'chase'
    heading: 0, // yaw the yeti is turning toward, radians
    wander: new THREE.Vector3(spawn[0], 0, spawn[2]), // current idle target
    wanderTimer: 0,
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
    if (a.mode === 'idle' && dist < DETECT_RADIUS) a.mode = 'chase'
    else if (a.mode === 'chase' && dist > LOSE_RADIUS) a.mode = 'idle'

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
    const glow = a.mode === 'chase' ? 1.6 : 0.15
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
