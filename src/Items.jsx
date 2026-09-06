import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGame, ITEM_TOTAL } from './store.js'
import { ARENA_HALF } from './Player.jsx'

// Step 4: embers scattered across the arena. Walk over one to grab it — it adds
// to your score and pushes warmth back up, so the risk of straying from spawn
// (and toward the yeti) is what keeps you alive. No physics; pickup is a plain
// distance check against the camera each frame.
const PICKUP_RADIUS = 2.2
const ITEM_SCORE = 100
const WARMTH_PER_ITEM = 16
const HOVER_HEIGHT = 0.9

// Same deterministic PRNG as the tree scatter — embers land in the same spots
// on every reload so a run is learnable.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Ring of placements: far enough out that you must leave the spawn to reach
// them, inside the arena bounds, and clear of the yeti's post at [0, 0, -22].
function useEmberSpots() {
  return useMemo(() => {
    const rand = mulberry32(90210)
    const spots = []
    let guard = 0
    while (spots.length < ITEM_TOTAL && guard++ < 500) {
      const x = (rand() * 2 - 1) * (ARENA_HALF - 4)
      const z = (rand() * 2 - 1) * (ARENA_HALF - 4)
      const fromSpawn = Math.hypot(x, z)
      if (fromSpawn < 10 || fromSpawn > ARENA_HALF - 3) continue
      if (Math.hypot(x, z + 22) < 7) continue // keep clear of the yeti spawn
      spots.push([x, HOVER_HEIGHT, z])
    }
    return spots
  }, [])
}

export default function Items() {
  const { camera } = useThree()
  const spots = useEmberSpots()
  const groups = useRef([])
  const [collected, setCollected] = useState(() => spots.map(() => false))
  // Synchronous guard against double-counting: `collected` (React state) doesn't
  // update until the next render, so a slow walk over an ember keeps the frame
  // loop seeing it as uncollected for several frames. This ref flips the instant
  // the pickup lands, so collectItem() fires exactly once per ember.
  const grabbed = useRef(new Set())

  useFrame((_, rawDelta) => {
    if (useGame.getState().status !== 'playing') return
    const delta = Math.min(rawDelta, 0.1)
    const t = performance.now() * 0.002

    let justGrabbed = -1
    for (let i = 0; i < spots.length; i++) {
      if (collected[i] || grabbed.current.has(i)) continue

      // Bob and spin so the embers catch the eye through the fog.
      const g = groups.current[i]
      if (g) {
        g.rotation.y += delta * 1.6
        g.position.y = HOVER_HEIGHT + Math.sin(t + i * 1.7) * 0.14
      }

      const dx = camera.position.x - spots[i][0]
      const dz = camera.position.z - spots[i][2]
      if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) justGrabbed = i
    }

    // justGrabbed is always a fresh index — the loop skips anything in `grabbed`.
    if (justGrabbed >= 0) {
      grabbed.current.add(justGrabbed)
      setCollected((c) => {
        const next = c.slice()
        next[justGrabbed] = true
        return next
      })
      useGame.getState().collectItem(ITEM_SCORE, WARMTH_PER_ITEM)
    }
  })

  return spots.map((p, i) =>
    collected[i] ? null : (
      <group
        key={i}
        ref={(el) => (groups.current[i] = el)}
        position={[p[0], HOVER_HEIGHT, p[2]]}
      >
        <mesh castShadow>
          <icosahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial
            color="#ffce8a"
            emissive="#ff7a1a"
            emissiveIntensity={1.5}
            roughness={0.35}
            flatShading
          />
        </mesh>
        {/* Warm pool of light on the snow — no shadow, kept cheap. */}
        <pointLight color="#ff9a3c" intensity={5} distance={7} decay={2} />
      </group>
    ),
  )
}
