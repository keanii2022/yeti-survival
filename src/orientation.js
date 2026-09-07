// Step 9.6: portrait detection + a best-effort fullscreen request. The pure
// helpers live here (no React, no three) so they're cheap to unit-test, same
// pattern as touch.js / joystick.js. OrientationNudge.jsx wires the listeners;
// App.jsx calls requestFullscreen from the first-touch handler.

// True when the viewport is taller than it is wide. matchMedia is the primary
// read; the innerHeight/innerWidth compare is the fallback for jsdom and any
// engine without the orientation media feature. Injectable so the test can
// drive it and a window-less environment just reads false.
export function isPortrait(
  win = typeof window !== 'undefined' ? window : undefined,
) {
  if (!win) return false
  try {
    if (typeof win.matchMedia === 'function') {
      const m = win.matchMedia('(orientation: portrait)')
      if (m && typeof m.matches === 'boolean') return m.matches
    }
  } catch {
    // fall through to the size compare
  }
  return win.innerHeight > win.innerWidth
}

// Ask the browser to take the page fullscreen. Best-effort: a missing method,
// a synchronous throw, or a rejected promise (iOS Safari on iPhone has no
// Fullscreen API) all no-op rather than surface. Must be called from inside a
// user-gesture handler or the browser rejects it anyway.
export function requestFullscreen(
  el = typeof document !== 'undefined' ? document.documentElement : undefined,
) {
  if (!el) return
  const fn = el.requestFullscreen || el.webkitRequestFullscreen
  if (typeof fn !== 'function') return
  try {
    const r = fn.call(el)
    if (r && typeof r.catch === 'function') r.catch(() => {})
  } catch {
    // fullscreen denied or unavailable — the add-to-home-screen manifest still
    // covers the chromeless launch on iOS
  }
}
