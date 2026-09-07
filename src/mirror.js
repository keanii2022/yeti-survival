// Step 7.2: the look-behind glance. Same off-React singleton pattern as
// threat.js / shelter.js — Player.jsx runs the whole glance state machine in its
// frame loop and writes `frost` here (0..1); the HUD polls it to fade the icy
// overlay. Kept out of the zustand store so ramping it every frame doesn't
// thrash subscribers.
//
// `frost` is the overlay opacity: 0 while the rear view is clear, ramps to 1 as
// the view frosts over, then melts back to 0 once you're facing front again.
// `ready` is false for the whole glance-plus-cooldown span — the HUD's "L" chip
// dims while it's down so you can see when a look-back is back.
export const mirror = { frost: 0, ready: true }

// Fresh scene (mount / restart): clear the overlay so a glance interrupted by a
// game-over can't leave the screen iced up.
export function resetMirror() {
  mirror.frost = 0
  mirror.ready = true
}
