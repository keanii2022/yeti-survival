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
const SPRINT_DRAIN = 13 // stamina/sec while sprinting — ~7.5s from a full bar.
// Eased from 16 in 6.6: enough runway to clear the yeti's ~24u lose-radius (L1)
// and cut sideways into cover, but a flat-out straight sprint still runs dry
// before a clean break.
const STAMINA_REGEN = 15 // stamina/sec while walking or standing still
const MAX_STEP = 0.1 // cap per-frame movement so a long delta can't teleport you

// Half-width of the walkable arena — a 120x120 square centred on the origin.
// Step 6.10 grew this from 30: the old 60x60 pen was barely wider than the
// yeti's LOSE_RADIUS, so a chase always ended at a wall. There's now room to
// cut sideways into the fog and actually shake it.
export const ARENA_HALF = 60

export default function Player() {
  const controls = useRef()
  const keys = useKeyboardControls()
  const { camera } = useThree()
  const status = useGame((s) => s.status)
  const over = status === 'caught' || status === 'frozen' || status === 'won'

  // While paused, disable the controls so mouse-look freezes but the pointer
  // stays captured — resuming with Space is then seamless. Once the run ends,
  // fully release the pointer so the mouse is free for the "press R" screen
  // (the controls also unmount below, removing the click-to-lock handler).
  useEffect(() => {
    if (controls.current) controls.current.enabled = status === 'playing'
    if (over) document.exitPointerLock?.()
  }, [status, over])

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

    // Sprint only lands if you're moving, holding Shift, and not winded.
    const game = useGame.getState()
    const moving = move.lengthSq() > 0
    const sprinting =
      moving && held.sprint && !game.sprintLocked && game.stamina > 0

    if (moving) {
      const speed = sprinting ? SPRINT_SPEED : WALK_SPEED
      move.normalize().multiplyScalar(speed * Math.min(delta, MAX_STEP))
      camera.position.add(move)
    }

    // Burn stamina while sprinting, regenerate it any other time.
    const step = Math.min(delta, MAX_STEP)
    game.tickStamina(sprinting, (sprinting ? SPRINT_DRAIN : STAMINA_REGEN) * step)

    // Keep the player pinned to eye height and inside the arena bounds.
    camera.position.y = EYE_HEIGHT
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ARENA_HALF, ARENA_HALF)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ARENA_HALF, ARENA_HALF)
  })

  // Unmount once the run is over so a stray click can't re-capture the mouse.
  return over ? null : <PointerLockControls ref={controls} />
}
