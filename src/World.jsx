import { useMemo } from 'react'
import { Sky } from '@react-three/drei'

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

      <Trees />
    </>
  )
}
