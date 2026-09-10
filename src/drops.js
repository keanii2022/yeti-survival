// Step 7.5: the dropped-item hint pip. Hold E (desktop) or long-press a slot
// button (touch) to ditch the selected item back into the world; this module
// tracks where those drops landed and the fuzzy bearing to the nearest one,
// which the HUD draws as a blurred arrow around the crosshair — direction only,
// no distance. Same off-React singleton pattern as mirror.js / greenEmber.js:
// Drops.jsx writes `bearing` every frame from inside the Canvas (it needs the
// camera), the HUD polls it.
//
// `list` is the live drops — each { id, kind, x, z, placed }. An entry leaves
// when the player walks back over it (Drops.jsx re-pockets it via grabItem) or
// on a fresh scene. `bearing` is radians offset from where you're facing: 0 dead
// ahead, + to your right, - to your left, ±PI behind — snapped to 8 sectors so
// it reads as a rough heading, not a laser line. null when nothing's out.
//
// Step 7.6: `placed` marks a blanket set down with Q (vs. a hold-E ditch). A
// placed entry is never auto-re-pocketed — you want to stand on it, not trip
// over it — but the pip still points back to it, and `onBlanket` flags the
// frames the player is inside one's radius so Survival.jsx can slow the drain.

export const drops = { list: [], bearing: null, onBlanket: false }

let nextId = 1

export function addDrop(kind, x, z, placed = false) {
  const entry = { id: nextId++, kind, x, z, placed }
  drops.list.push(entry)
  return entry
}

export function removeDrop(entry) {
  const i = drops.list.indexOf(entry)
  if (i !== -1) drops.list.splice(i, 1)
}

// Fresh scene (mount / restart): forget every drop and clear the pip so a
// marker from the last run can't linger into the next.
export function resetDrops() {
  drops.list.length = 0
  drops.bearing = null
  drops.onBlanket = false
}

// Signed angle from the facing vector (fx,fz) to the target vector (dx,dz), in
// radians (-PI, PI]. + is to the player's right (screen-clockwise, looking down
// the world-up axis), 0 is dead ahead, ±PI is behind. Both inputs are flattened
// onto the ground; a zero-length input falls back to "ahead".
export function screenBearing(fx, fz, dx, dz) {
  const fl = Math.hypot(fx, fz)
  const dl = Math.hypot(dx, dz)
  if (fl < 1e-6 || dl < 1e-6) return 0
  fx /= fl
  fz /= fl
  dx /= dl
  dz /= dl
  return Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz)
}

// Snap a bearing to the nearest of `sectors` evenly-spaced headings, so the pip
// jumps between rough directions instead of tracking a precise one — the
// "fuzzy" the README asks for.
export function fuzzBearing(rad, sectors = 8) {
  const step = (Math.PI * 2) / sectors
  return Math.round(rad / step) * step
}

// The drop nearest to (x,z) that passes `pred`, or null when nothing matches.
// Squared distance — the pip never shows how far, but Drops.jsx needs the
// closest entry to point at (any entry) and, separately, the closest
// re-pocketable one (pred = not placed), so a set-down blanket can't be
// hoovered back up as you stand on it.
export function nearestDrop(x, z, pred = () => true) {
  let best = null
  let bestD = Infinity
  for (const e of drops.list) {
    if (!pred(e)) continue
    const d = (e.x - x) ** 2 + (e.z - z) ** 2
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

// Step 7.6: is (x,z) within `radius` of any placed blanket? Drops.jsx polls this
// each frame and, on a change, flips the store's `blanketActive` so the warmth
// drain eases (Survival.jsx) for as long as you stand on the blanket — no timer,
// it's the spot that matters.
export function blanketUnderfoot(x, z, radius) {
  const r2 = radius * radius
  for (const e of drops.list) {
    if (!e.placed) continue
    if ((e.x - x) ** 2 + (e.z - z) ** 2 <= r2) return true
  }
  return false
}
