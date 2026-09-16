import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import { duck, resetDuck } from './duck.js'
import { poop, resetPoop } from './poop.js'
import { generateTrees, resolveTreeCollision } from './trees.js'
import { generateSheds, resolveShedCollision } from './sheds.js'
import { ARENA_HALF } from './arena.js'

// Step 7.8: the duck and poop throws. Both reuse 6.11's investigate-a-point
// behaviour (via duck.js / poop.js — same off-React singleton shape as the
// 6.14 decoy) and the exact same throw-arc mechanics as Decoy.jsx; only the
// yeti's reaction differs (see Yeti.jsx) and the two get their own visuals.
// The pickups themselves live in Consumables.jsx (the generic `Pickup`
// component already fits — no beacon-style presentation needed for a comedy
// item), so this file is throw + flight + landing only.
//
// One shared flight rig (`useThrow`) drives both — same parabola, same
// tree / shed collision on the landing point, same fade-out once the yeti's
// done with it or the safety timer runs out.

const THROW_DIST = 15 // how far ahead of you it lands (before clamps)
const ARC_HEIGHT = 2.6
const FLIGHT_TIME = 0.48 // seconds in the air
const HAND_HEIGHT = 1.4 // where it leaves your hand, roughly
const GROUND_Y = 0.3 // resting height once it lands
const MAX_GROUND_TIME = 8 // force-clear `live` if the yeti never reaches it
const FADE_TIME = 0.5 // fade / shrink once it's spent

// The flight + landing rig for one throwable. `kind` gates which `throwReq`
// bump is ours (see store.js's `pendingThrow`); `singleton` is duck.js's or
// poop.js's exported object. Returns the group ref + mount state for the
// caller to render its own mesh into.
function useThrow(kind, singleton, reset) {
  const { camera } = useThree()
  const trees = useMemo(() => generateTrees(), [])
  const sheds = useMemo(() => generateSheds(), [])

  const root = useRef()
  const fly = useRef(null)
  const [visible, setVisible] = useState(false)
  const [origin, setOrigin] = useState([0, 0])

  // The singleton is a module-level object — clear it for a fresh run.
  useEffect(() => {
    reset()
    return () => reset()
  }, [reset])

  // The throw fires here (not App.jsx) because the arc needs the camera
  // heading, which only lives inside the Canvas — same reasoning as Decoy.jsx.
  useEffect(() => {
    let seen = useGame.getState().throwReq
    return useGame.subscribe((s) => {
      if (s.throwReq === seen) return
      seen = s.throwReq
      if (s.status !== 'playing' || s.pendingThrow !== kind) return

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

      singleton.x = x
      singleton.z = z
      singleton.throwId += 1
      singleton.live = true
    })
  }, [camera, trees, sheds, kind, singleton])

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
      root.current.rotation.x += delta * 14
      root.current.rotation.z += delta * 9
      if (f.t >= 1) {
        f.stage = 'resting'
        f.ground = MAX_GROUND_TIME
        root.current.position.set(f.toX, GROUND_Y, f.toZ)
        root.current.rotation.set(0, 0, 0)
      }
    } else if (f.stage === 'resting') {
      f.ground -= delta
      // The yeti finishing with it (singleton.live back to false) or the
      // safety timer running out both end it — start the fade either way.
      if (!singleton.live || f.ground <= 0) {
        singleton.live = false
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

    root.current.scale.setScalar(f.stage === 'fading' ? Math.max(0.001, f.fade) : 1)
  })

  return { root, visible, origin }
}

// Bright rubber-duck yellow, squat body plus a small orange beak nub — reads
// as a toy at a glance even at low-poly, flat-shaded scale.
function DuckThrow() {
  const { root, visible, origin } = useThrow('duck', duck, resetDuck)
  if (!visible) return null
  return (
    <group ref={root} position={[origin[0], HAND_HEIGHT, origin[1]]}>
      <mesh castShadow scale={[1, 0.82, 1.25]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial
          color="#f4c430"
          emissive="#5c4400"
          emissiveIntensity={1.3}
          roughness={0.5}
          flatShading
        />
      </mesh>
      <mesh castShadow position={[0, -0.02, 0.34]}>
        <boxGeometry args={[0.16, 0.1, 0.16]} />
        <meshStandardMaterial
          color="#ff8c1a"
          emissive="#4a2600"
          emissiveIntensity={1.1}
          roughness={0.6}
          flatShading
        />
      </mesh>
    </group>
  )
}

// A small dark-brown stacked "soft-serve" — the classic silhouette, unmissable
// even through fog and, per the README, funny on purpose.
function PoopThrow() {
  const { root, visible, origin } = useThrow('poop', poop, resetPoop)
  if (!visible) return null
  return (
    <group ref={root} position={[origin[0], HAND_HEIGHT, origin[1]]}>
      <mesh castShadow scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial
          color="#5b3a1e"
          emissive="#150c04"
          emissiveIntensity={0.6}
          roughness={0.9}
          flatShading
        />
      </mesh>
      <mesh castShadow position={[0, 0.2, 0]} scale={[0.76, 0.55, 0.76]}>
        <sphereGeometry args={[0.24, 8, 6]} />
        <meshStandardMaterial
          color="#6a4526"
          emissive="#150c04"
          emissiveIntensity={0.6}
          roughness={0.9}
          flatShading
        />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]} scale={[0.5, 0.5, 0.5]}>
        <sphereGeometry args={[0.18, 8, 6]} />
        <meshStandardMaterial
          color="#7a5230"
          emissive="#150c04"
          emissiveIntensity={0.6}
          roughness={0.9}
          flatShading
        />
      </mesh>
    </group>
  )
}

export default function Throwables() {
  return (
    <>
      <DuckThrow />
      <PoopThrow />
    </>
  )
}
