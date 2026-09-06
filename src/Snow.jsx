import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'

// Step 5 atmosphere: a flurry of falling flakes that always surrounds the
// player. It's one THREE.Points cloud living in a box centred on the camera —
// flakes that fall out the bottom (or drift past an edge as you walk) are
// wrapped back in, so a fixed pool of points covers the whole arena for cheap.
const COUNT = 1500
const BOX = 42 // width/depth of the flurry box, metres
const TOP = 22 // flakes recycle to this height
const FALL = 3.0 // base descent, m/s
const DRIFT = 0.5 // lateral sway amplitude

// Same deterministic PRNG the tree/ember scatter uses — keeps the initial
// flake layout stable across re-renders (and keeps the lint's purity rule
// happy, which bans Math.random during render).
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function Snow() {
  const points = useRef()
  const { camera } = useThree()

  // Initial scatter plus a per-flake fall-speed multiplier for a bit of variety.
  const { positions, speeds } = useMemo(() => {
    const rand = mulberry32(19700101)
    const positions = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (rand() - 0.5) * BOX
      positions[i * 3 + 1] = rand() * TOP
      positions[i * 3 + 2] = (rand() - 0.5) * BOX
      speeds[i] = 0.6 + rand() * 0.9
    }
    return { positions, speeds }
  }, [])

  // Soft round flake — a radial-gradient sprite beats hard little squares.
  const sprite = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.8)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(c)
  }, [])

  useFrame((_, rawDelta) => {
    // Freeze the flurry whenever the sim is paused or the run is over.
    if (useGame.getState().status !== 'playing') return
    const p = points.current
    if (!p) return

    const delta = Math.min(rawDelta, 0.1)
    const arr = p.geometry.attributes.position.array
    const t = performance.now() * 0.001
    const ox = camera.position.x
    const oz = camera.position.z
    const half = BOX / 2

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const iy = ix + 1
      const iz = ix + 2

      arr[iy] -= FALL * speeds[i] * delta
      arr[ix] += Math.sin(t * 0.7 + i) * DRIFT * delta

      // Recycle to the top once it hits the ground.
      if (arr[iy] < 0) {
        arr[iy] += TOP
        arr[ix] = ox + (Math.random() - 0.5) * BOX
        arr[iz] = oz + (Math.random() - 0.5) * BOX
      }

      // Wrap horizontally so the box stays pinned to the player as they move.
      if (arr[ix] - ox > half) arr[ix] -= BOX
      else if (arr[ix] - ox < -half) arr[ix] += BOX
      if (arr[iz] - oz > half) arr[iz] -= BOX
      else if (arr[iz] - oz < -half) arr[iz] += BOX
    }

    p.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={0.13}
        sizeAttenuation
        transparent
        depthWrite={false}
        opacity={0.9}
        color="#ffffff"
      />
    </points>
  )
}
