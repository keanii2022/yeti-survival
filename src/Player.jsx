import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboardControls } from './hooks/useKeyboardControls.js'
import { useGame } from './store.js'

// First-person controller: mouse look via PointerLockControls, WASD movement
// on the ground plane. No physics yet — the player floats at a fixed eye
// height and is clamped to the arena. Collision comes with the yeti in step 3.
const EYE_HEIGHT = 1.7
const WALK_SPEED = 6 // metres / second
const SPRINT_SPEED = 10
const MAX_STEP = 0.1 // cap per-frame movement so a long delta can't teleport you

// Half-width of the walkable arena (a 60x60 square centred on the origin).
export const ARENA_HALF = 30

export default function Player() {
  const controls = useRef()
  const keys = useKeyboardControls()
  const { camera } = useThree()
  const status = useGame((s) => s.status)

  // Drop pointer lock the moment the run ends — caught or frozen — so the mouse
  // is free for the "try again" overlay.
  useEffect(() => {
    if (status !== 'playing') controls.current?.unlock()
  }, [status])

  // Reused each frame to avoid allocating vectors in the render loop.
  const scratch = useMemo(
    () => ({
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      move: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((_, delta) => {
    if (!controls.current?.isLocked) return
    if (useGame.getState().status !== 'playing') return

    const held = keys.current
    const { forward, right, move } = scratch

    // Walk direction is the camera's heading flattened onto the ground.
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, camera.up).normalize()

    move.set(0, 0, 0)
    if (held.forward) move.add(forward)
    if (held.backward) move.sub(forward)
    if (held.right) move.add(right)
    if (held.left) move.sub(right)

    if (move.lengthSq() > 0) {
      const speed = held.sprint ? SPRINT_SPEED : WALK_SPEED
      move.normalize().multiplyScalar(speed * Math.min(delta, MAX_STEP))
      camera.position.add(move)
    }

    // Keep the player pinned to eye height and inside the arena bounds.
    camera.position.y = EYE_HEIGHT
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA_HALF, ARENA_HALF)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA_HALF, ARENA_HALF)
  })

  return <PointerLockControls ref={controls} />
}
