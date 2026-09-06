import { useMemo } from 'react'
import { Sky } from '@react-three/drei'
import { ARENA_HALF } from './Player.jsx'

// Small deterministic PRNG so the tree scatter is the same on every reload.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A single snow-dusted pine, built from primitives.
function PineTree({ position, scale }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 1.2, 6]} />
        <meshStandardMaterial color="#5b4636" roughness={1} />
      </mesh>
      <mesh position={[0, 2, 0]} castShadow>
        <coneGeometry args={[1.1, 2.6, 7]} />
        <meshStandardMaterial color="#2f4a3d" roughness={1} />
      </mesh>
      <mesh position={[0, 3, 0]} castShadow>
        <coneGeometry args={[0.7, 1.4, 7]} />
        <meshStandardMaterial color="#eef4f8" roughness={1} />
      </mesh>
    </group>
  )
}

// A single snow-capped peak: a broad rock cone with a smaller white cone on top.
// Low segment counts keep the far-off ring cheap; it's never seen up close.
function Peak({ position, radius, height, rotation }) {
  const capHeight = height * 0.32
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, height / 2, 0]}>
        <coneGeometry args={[radius, height, 6]} />
        <meshStandardMaterial color="#8a94a0" roughness={1} />
      </mesh>
      <mesh position={[0, height - capHeight / 2, 0]}>
        <coneGeometry args={[radius * 0.42, capHeight, 6]} />
        <meshStandardMaterial color="#eef4f8" roughness={1} />
      </mesh>
    </group>
  )
}

// A ring of mountains wrapping the arena so the edge reads before you walk into
// the invisible clamp at ARENA_HALF. Pure set dressing — no collision. A dense
// front row sits just past the wall with overlapping bases so it looks like one
// massif; a sparser, taller back row adds silhouette depth and half-sinks into
// the fog so it looms instead of popping.
function Mountains() {
  const peaks = useMemo(() => {
    const rand = mulberry32(41530207)
    const placed = []

    const ring = (count, baseR, jitterR, minH, maxH, minRad, maxRad) => {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.4
        const r = baseR + (rand() - 0.5) * jitterR
        placed.push({
          position: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
          radius: minRad + rand() * (maxRad - minRad),
          height: minH + rand() * (maxH - minH),
          rotation: rand() * Math.PI * 2,
        })
      }
    }

    // Front massif: bases just outside the clamp, overlapping into a wall.
    ring(30, ARENA_HALF + 8, 6, 14, 24, 7, 12)
    // Back range: fewer, bigger, further out and mostly fog-shrouded.
    ring(16, ARENA_HALF + 24, 8, 26, 40, 10, 16)

    return placed
  }, [])

  return peaks.map((p, i) => <Peak key={i} {...p} />)
}

// Scatter of landmark trees near the arena edge — gives the empty plane a
// sense of scale and something to steer around while testing movement.
function Trees({ count = 44, spread = 27 }) {
  const trees = useMemo(() => {
    const rand = mulberry32(20260905)
    const placed = []
    while (placed.length < count) {
      const x = (rand() * 2 - 1) * spread
      const z = (rand() * 2 - 1) * spread
      if (Math.hypot(x, z) < 7) continue // keep the spawn area clear
      placed.push({
        position: [x, 0, z],
        scale: 0.8 + rand() * 0.9,
      })
    }
    return placed
  }, [count, spread])

  return trees.map((t, i) => <PineTree key={i} {...t} />)
}

// The snowy world: ground, sky, lighting, fog, and landmark trees.
export default function World() {
  return (
    <>
      {/* Cold blue-grey fog closes visibility down fast for a claustrophobic feel */}
      <fog attach="fog" args={['#c8d2dc', 12, 70]} />
      <color attach="background" args={['#c8d2dc']} />

      {/* Overcast winter sky */}
      <Sky sunPosition={[8, 4, -10]} turbidity={8} rayleigh={0.6} inclination={0.48} />

      {/* Soft fill so nothing is pitch black, plus a low sun for long shadows */}
      <hemisphereLight args={['#eaf1f7', '#9fb0bf', 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[8, 12, -6]}
        intensity={1.1}
        color="#f2f6ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Snowy ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#eef4f8" roughness={1} metalness={0} />
      </mesh>

      <Mountains />
      <Trees />
    </>
  )
}
