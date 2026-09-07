import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboardControls } from './hooks/useKeyboardControls.js'
import { useGame } from './store.js'
import { applyDragLook, inLookZone, LOOK_CONTROL_SELECTOR } from './touch.js'
import { greenEmber } from './greenEmber.js'
import { mirror, resetMirror } from './mirror.js'
import { generateTrees, resolveTreeCollision } from './trees.js'
import { generateSheds, resolveShedCollision } from './sheds.js'
import { ARENA_HALF } from './arena.js'

// First-person controller: mouse look via PointerLockControls, WASD movement
// on the ground plane. No physics yet — the player floats at a fixed eye
// height and is clamped to the arena. Collision comes with the yeti in step 3.
const EYE_HEIGHT = 1.7
const WALK_SPEED = 6 // metres / second
const SPRINT_SPEED = 10
// 6.7: sprinting inside the green ember's radius (or the escape window just
// after grabbing it) runs at this instead — a hair over the yeti's hardest
// close-range lunge, so the risky grab-and-run is survivable.
const ADRENALINE_SPEED = 11
const SPRINT_DRAIN = 13 // stamina/sec while sprinting — ~7.5s from a full bar.
// Eased from 16 in 6.6: enough runway to clear the yeti's ~24u lose-radius (L1)
// and cut sideways into cover, but a flat-out straight sprint still runs dry
// before a clean break.
const STAMINA_REGEN = 15 // stamina/sec while walking or standing still
const MAX_STEP = 0.1 // cap per-frame movement so a long delta can't teleport you
const PLAYER_RADIUS = 0.4 // body circle for the 6.9 tree push-out

// 7.2: the look-behind glance (press L). You cut, then check — a coarse read on
// whether the 7.1 turn-rate cap actually opened a gap. The camera snaps 180°,
// mouse-look freezes, and you keep running the way you were already headed for
// GLANCE_LOOK_TIME. Then the rear view frosts over (GLANCE_FROST_TIME) — behind
// that white-out the camera flips back to front — and the frost melts
// (GLANCE_MELT_TIME) as you face forward again. GLANCE_COOLDOWN before L works
// once more, so it can't be held open as a rear-view mirror. No yeti bearing on
// the HUD, ever: the reversed view and the frost are the whole feedback.
const GLANCE_LOOK_TIME = 1.3
const GLANCE_FROST_TIME = 0.7
const GLANCE_MELT_TIME = 0.5
const GLANCE_COOLDOWN = 2
// The glance turns the view with a true 180° spin about world-up — not by adding
// to camera.rotation.y, whose XYZ Euler order folds any pitch into a tilt that
// survives the flip back. Another 180° about the same axis undoes it exactly.
const WORLD_UP = new THREE.Vector3(0, 1, 0)

// Half-width of the walkable arena — a 120x120 square centred on the origin.
// Step 6.10 grew this from 30: the old 60x60 pen was barely wider than the
// yeti's LOSE_RADIUS, so a chase always ended at a wall. There's now room to
// cut sideways into the fog and actually shake it. Lives in arena.js now (so the
// pure modules can read it without dragging three/drei in); re-exported here so
// every importer that reached for it from Player.jsx still works.
export { ARENA_HALF } from './arena.js'

export default function Player() {
  const controls = useRef()
  const keys = useKeyboardControls()
  const { camera } = useThree()
  const status = useGame((s) => s.status)
  const isTouch = useGame((s) => s.isTouch)
  const over = status === 'caught' || status === 'frozen' || status === 'won'

  // 9.1 touch drag-look accumulator. `yaw`/`pitch` are the view angles the frame
  // loop writes onto the camera (there's no PointerLockControls doing it on
  // touch); `active` is the identifier of the one finger currently driving look,
  // `lastX`/`lastY` its previous position. Untouched on desktop.
  const look = useRef({ yaw: 0, pitch: 0, active: null, lastX: 0, lastY: 0 })

  // 7.2 glance state. phase: 'idle' | 'look' | 'frost' | 'melt' | 'cooldown'.
  // `fwd` is the travel heading captured the instant L was pressed — movement
  // stays locked to it through 'look'/'frost' so holding W keeps you running
  // away from the yeti while the camera is turned around looking at it.
  const glance = useRef({ phase: 'idle', t: 0, fwd: new THREE.Vector3(0, 0, -1) })

  // Bail a glance that's cut short by a pause or the run ending — flip the
  // camera back if it's still reversed, drop the frost, so we never leave the
  // view half-turned or iced up.
  const endGlance = useCallback(() => {
    const gl = glance.current
    if (gl.phase === 'look' || gl.phase === 'frost') {
      camera.rotateOnWorldAxis(WORLD_UP, Math.PI)
    }
    gl.phase = 'idle'
    gl.t = 0
    mirror.frost = 0
    mirror.ready = true
    document.documentElement.style.setProperty('--frost', '0')
  }, [camera])

  // While paused, disable the controls so mouse-look freezes but the pointer
  // stays captured — resuming with Space is then seamless. Once the run ends,
  // fully release the pointer so the mouse is free for the "press R" screen
  // (the controls also unmount below, removing the click-to-lock handler).
  useEffect(() => {
    if (status !== 'playing' && glance.current.phase !== 'idle') endGlance()
    if (controls.current) controls.current.enabled = status === 'playing'
    if (over) document.exitPointerLock?.()
  }, [status, over, endGlance])

  // mirror.frost is a module singleton — clear it for a fresh scene so a glance
  // interrupted by a game-over can't carry its ice into the next run.
  useEffect(() => {
    resetMirror()
    document.documentElement.style.setProperty('--frost', '0')
    return () => {
      resetMirror()
      document.documentElement.style.setProperty('--frost', '0')
    }
  }, [])

  // 7.2: L starts a look-behind glance. Edge-triggered with a cooldown (the
  // phase machine in the frame loop owns the timing), not a held movement
  // intent, so it lives here rather than in useKeyboardControls.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'KeyL' || e.repeat) return
      if (useGame.getState().status !== 'playing') return
      if (!controls.current?.isLocked) return
      const gl = glance.current
      if (gl.phase !== 'idle') return
      // Freeze the travel heading, spin the view 180°, cut mouse-look.
      camera.getWorldDirection(gl.fwd)
      gl.fwd.y = 0
      if (gl.fwd.lengthSq() < 1e-6) gl.fwd.set(0, 0, -1)
      gl.fwd.normalize()
      camera.rotateOnWorldAxis(WORLD_UP, Math.PI)
      controls.current.enabled = false
      gl.phase = 'look'
      gl.t = 0
      mirror.ready = false
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [camera])

  // 9.1: drag-look on touch. A finger that lands in the right-hand look zone
  // (and not on an on-screen control) is claimed; its drag turns the view at
  // DRAG_LOOK_SENSITIVITY — no pointer lock, no inertia. Fingers in the left
  // zone fall straight through for the 9.2 movement joystick. Pitch clamps
  // exactly where the mouse path does (touch.js). Desktop never mounts this.
  useEffect(() => {
    if (!isTouch) return
    // Seed the angles from wherever the camera currently faces (spawn heading,
    // or a fresh scene after a restart remounts this component).
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    look.current.yaw = e.y
    look.current.pitch = e.x
    look.current.active = null

    const findActive = (list) => {
      for (const t of list) if (t.identifier === look.current.active) return t
      return null
    }
    const onStart = (ev) => {
      if (look.current.active !== null) return
      if (useGame.getState().status !== 'playing') return
      for (const t of ev.changedTouches) {
        if (t.target?.closest?.(LOOK_CONTROL_SELECTOR)) continue
        if (!inLookZone(t.clientX, window.innerWidth)) continue
        look.current.active = t.identifier
        look.current.lastX = t.clientX
        look.current.lastY = t.clientY
        break
      }
    }
    const onMove = (ev) => {
      if (look.current.active === null) return
      const t = findActive(ev.changedTouches)
      if (!t) return
      const dx = t.clientX - look.current.lastX
      const dy = t.clientY - look.current.lastY
      look.current.lastX = t.clientX
      look.current.lastY = t.clientY
      // Freeze the view while paused / between control — just keep the anchor
      // current so resuming the drag doesn't jump.
      if (useGame.getState().status !== 'playing') return
      const next = applyDragLook(look.current.yaw, look.current.pitch, dx, dy)
      look.current.yaw = next.yaw
      look.current.pitch = next.pitch
    }
    const onEnd = (ev) => {
      if (look.current.active !== null && findActive(ev.changedTouches)) {
        look.current.active = null
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [isTouch, camera])

  // Trunk / shed colliders for this run — fixed-seed lists shared with World.jsx.
  const trees = useMemo(() => generateTrees(), [])
  const sheds = useMemo(() => generateSheds(), [])

  // Reused each frame to avoid allocating vectors in the render loop.
  const scratch = useMemo(
    () => ({
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      move: new THREE.Vector3(),
      hit: { x: 0, z: 0 },
    }),
    [],
  )

  useFrame((_, delta) => {
    // Desktop waits for pointer lock; touch is always "in control" once playing.
    if (!isTouch && !controls.current?.isLocked) return
    if (useGame.getState().status !== 'playing') return

    // On touch, the drag-look handlers have accumulated yaw/pitch — write them
    // onto the camera here, before the heading is read for movement below.
    if (isTouch) {
      camera.rotation.order = 'YXZ'
      camera.rotation.set(look.current.pitch, look.current.yaw, 0)
    }

    const held = keys.current
    const { forward, right, move, hit } = scratch

    // --- 7.2 look-behind glance ---
    const gl = glance.current
    if (gl.phase !== 'idle') {
      gl.t += delta
      if (gl.phase === 'look') {
        if (gl.t >= GLANCE_LOOK_TIME) { gl.phase = 'frost'; gl.t = 0 }
      } else if (gl.phase === 'frost') {
        mirror.frost = Math.min(1, gl.t / GLANCE_FROST_TIME)
        if (gl.t >= GLANCE_FROST_TIME) {
          // Behind the white-out: flip back to front and hand mouse-look back.
          camera.rotateOnWorldAxis(WORLD_UP, Math.PI)
          if (controls.current) controls.current.enabled = true
          mirror.frost = 1
          gl.phase = 'melt'
          gl.t = 0
        }
      } else if (gl.phase === 'melt') {
        mirror.frost = Math.max(0, 1 - gl.t / GLANCE_MELT_TIME)
        if (gl.t >= GLANCE_MELT_TIME) { mirror.frost = 0; gl.phase = 'cooldown'; gl.t = 0 }
      } else if (gl.phase === 'cooldown') {
        if (gl.t >= GLANCE_COOLDOWN) { gl.phase = 'idle'; gl.t = 0 }
      }
      document.documentElement.style.setProperty('--frost', mirror.frost.toFixed(3))
    }
    mirror.ready = gl.phase === 'idle'

    // Walk direction is the camera's heading flattened onto the ground — except
    // mid-glance, when the camera is turned around: movement stays welded to the
    // heading you had when you pressed L, so a look-back doesn't run you at the
    // yeti.
    if (gl.phase === 'look' || gl.phase === 'frost') {
      forward.copy(gl.fwd)
    } else {
      camera.getWorldDirection(forward)
      forward.y = 0
      forward.normalize()
    }
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
      const sprintSpeed = greenEmber.boost ? ADRENALINE_SPEED : SPRINT_SPEED
      const speed = sprinting ? sprintSpeed : WALK_SPEED
      move.normalize().multiplyScalar(speed * Math.min(delta, MAX_STEP))
      camera.position.add(move)
    }

    // Burn stamina while sprinting, regenerate it any other time.
    const step = Math.min(delta, MAX_STEP)
    game.tickStamina(sprinting, (sprinting ? SPRINT_DRAIN : STAMINA_REGEN) * step)

    // Bump back out of any tree trunk (6.9) or shed wall (6.12) we stepped into
    // — the doorway gap is the one way through a shed — then keep the player
    // pinned to eye height and inside the arena bounds.
    resolveTreeCollision(trees, camera.position.x, camera.position.z, PLAYER_RADIUS, hit)
    resolveShedCollision(sheds, hit.x, hit.z, PLAYER_RADIUS, hit)
    camera.position.x = THREE.MathUtils.clamp(hit.x, -ARENA_HALF, ARENA_HALF)
    camera.position.z = THREE.MathUtils.clamp(hit.z, -ARENA_HALF, ARENA_HALF)
    camera.position.y = EYE_HEIGHT
  })

  // No pointer lock on touch — iOS Safari won't grant it, and the drag-look
  // effect drives the camera instead. On desktop, unmount once the run is over
  // so a stray click can't re-capture the mouse.
  if (isTouch) return null
  return over ? null : <PointerLockControls ref={controls} />
}
