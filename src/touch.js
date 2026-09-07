// Step 9.1: the coarse-pointer / touch layer's pure helpers. Detection and the
// drag-look math live here (no three, no React) so they're cheap to unit-test;
// Player.jsx wires the touch events, App.jsx flips the store flag.

// Drag-look sensitivity, radians of view rotation per CSS pixel dragged. The
// mouse path (PointerLockControls) turns ~0.002 rad/px off raw movementX; a
// thumb drag covers far less screen per look, so it's tuned much hotter. No
// inertia — the view stops the instant the thumb does. Raised from 0.004 after
// a phone playtest: at 0.004 a 180 turn took ~2 full swipes; at 0.009 one
// right-zone swipe covers ~170.
export const DRAG_LOOK_SENSITIVITY = 0.009

// The look zone is the right slice of the viewport. A touch that starts to the
// left of this (where the movement joystick lands in 9.2) never drives look;
// nor does one that starts on an on-screen control (see LOOK_CONTROL_SELECTOR).
export const LOOK_ZONE_FRACTION = 0.55

// On-screen buttons / the joystick tag themselves with this so a touch that
// starts on them is swallowed and never leaks into look. Nothing wears it until
// 9.2/9.3, but the guard is in place now.
export const LOOK_CONTROL_SELECTOR = '[data-touch-control]'

// Pitch clamp, matched to PointerLockControls' default polar-angle limit
// (Math.PI/2 either side of the horizon) so a touch look tops out exactly where
// a mouse look does.
export const PITCH_LIMIT = Math.PI / 2

// True on a coarse-pointer device. matchMedia is the primary read; App.jsx also
// latches the flag on the first real touchstart for devices/emulators that
// report 'fine' until touched. Injectable + defensive so the test can drive it
// and a matchMedia-less environment just reads false.
export function detectCoarsePointer(
  mm = typeof window !== 'undefined' ? window.matchMedia : undefined,
) {
  if (typeof mm !== 'function') return false
  try {
    return mm('(pointer: coarse)').matches
  } catch {
    return false
  }
}

// Is a touch at clientX inside the look zone — the right LOOK_ZONE_FRACTION of a
// viewportWidth-wide screen?
export function inLookZone(
  clientX,
  viewportWidth,
  fraction = LOOK_ZONE_FRACTION,
) {
  if (!(viewportWidth > 0)) return false
  return clientX >= viewportWidth * (1 - fraction)
}

// Apply a drag delta (dx, dy in CSS px) to the current yaw/pitch. Yaw wraps
// freely; pitch clamps to +/-PITCH_LIMIT. Signs match the mouse path: drag
// right -> look right, drag down -> look down.
export function applyDragLook(
  yaw,
  pitch,
  dx,
  dy,
  sensitivity = DRAG_LOOK_SENSITIVITY,
) {
  const nextYaw = yaw - dx * sensitivity
  const nextPitch = Math.max(
    -PITCH_LIMIT,
    Math.min(PITCH_LIMIT, pitch - dy * sensitivity),
  )
  return { yaw: nextYaw, pitch: nextPitch }
}
