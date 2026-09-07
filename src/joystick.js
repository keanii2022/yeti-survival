// Step 9.2: the left-thumb movement joystick's pure math + its live-state
// singleton. TouchControls.jsx wires the touch events and draws the stick;
// Player.jsx's frame loop reads `touchMove` in place of the WASD keys.

// A floating stick: it plants where the thumb lands. `baseRadius` is the throw
// that maps to full move speed; past `SPRINT_LATCH_RATIO x baseRadius` the
// sprint latch engages. Deadzone is a fraction of the base radius.
export const JOYSTICK_BASE_RADIUS = 60
export const JOYSTICK_DEADZONE = 0.12
// Eased from 1.4 after a phone playtest — latching sprint at 1.4x the ring
// (~84px from the plant point) was a thumb-stretch; 1.25x (~75px) latches on a
// firm push without reaching.
export const SPRINT_LATCH_RATIO = 1.25

// Live joystick readout — same off-React singleton pattern as threat.js /
// mirror.js so dragging it every frame doesn't thrash React. `x`/`y` are a
// ground-plane move vector (x = strafe right, y = forward), each -1..1; `mag`
// is its length 0..1; `sprint` is the latched sprint flag.
export const touchMove = { x: 0, y: 0, mag: 0, sprint: false }

// Fresh scene (mount / restart): drop any held stick so a run can't start
// mid-stride.
export function resetTouchMove() {
  touchMove.x = 0
  touchMove.y = 0
  touchMove.mag = 0
  touchMove.sprint = false
}

// Map a thumb offset (dx, dy in CSS px from where the stick was planted) to a
// move vector. Screen-down (+dy) is backward, so y is negated. Inside the
// deadzone -> zero; from the deadzone edge to the base radius -> 0..1 linearly;
// past the base radius -> clamped to 1 (the extra travel latches sprint, it
// doesn't add speed).
export function joystickVector(
  dx,
  dy,
  baseRadius = JOYSTICK_BASE_RADIUS,
  deadzone = JOYSTICK_DEADZONE,
) {
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return { x: 0, y: 0, mag: 0 }
  const dead = baseRadius * deadzone
  if (dist <= dead) return { x: 0, y: 0, mag: 0 }
  const mag = Math.min(1, (dist - dead) / (baseRadius - dead))
  return { x: (dx / dist) * mag, y: (-dy / dist) * mag, mag }
}

// Sprint is a latch with hysteresis: it engages once the thumb is past
// SPRINT_LATCH_RATIO x baseRadius, and only releases when pulled back inside
// baseRadius. In the band between, it holds its previous state.
export function sprintLatch(prev, offsetDist, baseRadius = JOYSTICK_BASE_RADIUS) {
  if (offsetDist >= baseRadius * SPRINT_LATCH_RATIO) return true
  if (offsetDist <= baseRadius) return false
  return prev
}
