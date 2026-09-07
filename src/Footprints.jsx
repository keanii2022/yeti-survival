import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import {
  trail,
  stampPrint,
  ageTrail,
  resetTrail,
  TRAIL_CAPACITY,
  PRINT_TTL,
} from './footprints.js'
import { surfaceAt } from './surface.js'

// Step 7.3 — the player's tracks in the snow.
//
// Stamps a print under the camera every stride (footprints.js owns the spacing
// and the ageing) and redraws the whole ring as flat scuffs pressed into the
// ground. A print starts as a dark boot-mark and lerps toward the snow colour
// as it ages, shrinking a little, until it's retired at PRINT_TTL. On hard
// ground (surface.js — a shed floor) nothing is stamped, so a dash across it
// leaves the yeti no trail to follow. Yeti.jsx reads the same singleton to walk
// the trail during a 6.11 search.

const PRINT_SIZE = 0.32
const FRESH = new THREE.Color('#3b4654') // a pressed-in boot mark
const GONE = new THREE.Color('#eef4f8') // the ground colour it fades into
const Y_AXIS = new THREE.Vector3(0, 1, 0)
// Lay the disc flat (face up), then yaw it per-print about world up.
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))

export default function Footprints() {
  const { camera } = useThree()
  const inst = useRef()

  const geom = useMemo(() => new THREE.CircleGeometry(PRINT_SIZE, 12), [])
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff', // instanceColor does the tinting
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const yaw = useMemo(() => new THREE.Quaternion(), [])
  const col = useMemo(() => new THREE.Color(), [])

  useEffect(() => () => (geom.dispose(), mat.dispose()), [geom, mat])

  // Fresh scene — wipe any trail the last run left in the singleton, and start
  // every instance hidden so nothing flashes at the origin before frame one.
  useEffect(() => {
    resetTrail()
    const g = inst.current
    if (g) {
      dummy.scale.setScalar(0.0001)
      dummy.position.set(0, -10, 0)
      dummy.updateMatrix()
      for (let i = 0; i < TRAIL_CAPACITY; i++) g.setMatrixAt(i, dummy.matrix)
      g.instanceMatrix.needsUpdate = true
    }
    return () => resetTrail()
  }, [dummy])

  useFrame((_, rawDelta) => {
    const g = inst.current
    if (!g) return
    // Freeze with everything else once the run's over or paused.
    if (useGame.getState().status !== 'playing') return
    const delta = Math.min(rawDelta, 0.1)

    ageTrail(delta)
    if (surfaceAt(camera.position.x, camera.position.z) === 'snow') {
      stampPrint(camera.position.x, camera.position.z)
    }

    for (let i = 0; i < TRAIL_CAPACITY; i++) {
      const s = trail.slots[i]
      const k = s.live ? 1 - s.age / PRINT_TTL : 0 // 1 fresh → 0 gone
      if (k <= 0) {
        dummy.scale.setScalar(0.0001)
        dummy.position.set(0, -10, 0)
        dummy.quaternion.copy(FLAT)
      } else {
        yaw.setFromAxisAngle(Y_AXIS, s.rot)
        dummy.quaternion.copy(yaw).multiply(FLAT)
        dummy.position.set(s.x, 0.02, s.z)
        dummy.scale.set(0.82 + k * 0.18, 1, 0.62 + k * 0.14) // slight boot oval
      }
      dummy.updateMatrix()
      g.setMatrixAt(i, dummy.matrix)
      g.setColorAt(i, col.copy(FRESH).lerp(GONE, 1 - k))
    }
    g.instanceMatrix.needsUpdate = true
    if (g.instanceColor) g.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={inst}
      args={[geom, mat, TRAIL_CAPACITY]}
      frustumCulled={false}
      renderOrder={1}
    />
  )
}
