import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import {
  generateCampfires,
  nearCampfire,
  CAMPFIRE_RADIUS,
  campfireGlow,
  resetCampfireGlow,
} from './campfire.js'
import { playerBody } from './playerBody.js'

// Step 7.14 — the campfires you can warm up at. Built from primitives to match
// the shed / tree style: a ring of stones, a few crossed logs, a flickering
// flame, and a point light that breathes with it. The proximity check here is
// the single source of truth for campfireGlow.near, which Survival.jsx (warmth
// regen) and Yeti.jsx (the detection balloon) both poll off React — same
// shared-readout shape as shelter.js.

const FLAME_COLOR = '#ff8a3d'
const GLOW_COLOR = '#ffb066'

// One fire: a stone ring, three crossed logs, a soft additive flame cone that
// flickers in scale and a point light that breathes with it. `seed` offsets
// the flicker phase so a run with several fires doesn't pulse in lockstep.
function Fire({ x, z, seed }) {
  const flame = useRef()
  const light = useRef()
  const glow = useRef()

  useFrame(() => {
    const t = performance.now() * 0.006 + seed
    const flicker = 0.78 + Math.sin(t) * 0.14 + Math.sin(t * 2.7) * 0.08
    if (flame.current) {
      flame.current.scale.set(1, flicker, 1)
      flame.current.rotation.y = t * 0.4
    }
    if (light.current) light.current.intensity = 6.5 * flicker
    if (glow.current) glow.current.material.opacity = 0.16 * flicker
  })

  const stones = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return [Math.cos(a) * 0.85, Math.sin(a) * 0.85]
      }),
    [],
  )

  return (
    <group position={[x, 0, z]}>
      {/* soft warm pool on the snow — reads from a distance like a shed's
          window light, so a fire is spottable before you're on top of it */}
      <mesh ref={glow} position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CAMPFIRE_RADIUS * 0.85, 24]} />
        <meshBasicMaterial
          color={GLOW_COLOR}
          transparent
          opacity={0.16}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {stones.map(([sx, sz], i) => (
        <mesh key={i} position={[sx, 0.12, sz]} castShadow>
          <sphereGeometry args={[0.22, 6, 6]} />
          <meshStandardMaterial color="#5a5a5a" roughness={1} flatShading />
        </mesh>
      ))}

      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[0, 0.16, 0]}
          rotation={[0, (i / 3) * Math.PI, Math.PI / 2 + 0.2]}
          castShadow
        >
          <cylinderGeometry args={[0.09, 0.11, 1.4, 6]} />
          <meshStandardMaterial color="#3d2c1f" roughness={1} />
        </mesh>
      ))}

      <mesh ref={flame} position={[0, 0.5, 0]}>
        <coneGeometry args={[0.3, 0.95, 8]} />
        <meshBasicMaterial
          color={FLAME_COLOR}
          transparent
          opacity={0.85}
          fog={false}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <pointLight
        ref={light}
        position={[0, 0.7, 0]}
        color={FLAME_COLOR}
        intensity={6.5}
        distance={CAMPFIRE_RADIUS * 3.2}
        decay={2}
        castShadow
      />
    </group>
  )
}

export default function Campfire() {
  const campfires = useMemo(() => generateCampfires(), [])

  useEffect(() => {
    resetCampfireGlow()
    return resetCampfireGlow
  }, [])

  useFrame(() => {
    if (useGame.getState().status !== 'playing') {
      campfireGlow.near = false
      return
    }
    // A touch of hysteresis on the radius, same trick as the blanket's
    // onBlanket check (Drops.jsx) — keeps the edge from chattering the flag
    // (and the HUD cue / warmth swing riding on it) right at the boundary.
    const r = campfireGlow.near ? CAMPFIRE_RADIUS + 0.4 : CAMPFIRE_RADIUS
    campfireGlow.near = nearCampfire(campfires, playerBody.x, playerBody.z, r)
  })

  return campfires.map((c, i) => <Fire key={i} x={c.x} z={c.z} seed={i * 7.3} />)
}
