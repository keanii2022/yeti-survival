// Step 7.3 — the player's footprint trail in the snow.
//
// The player stamps a print every stride. When the yeti loses sight and drops
// into its 6.11 search, it no longer teleports its attention to your last-known
// spot — it picks up the nearest print and walks the trail there, so a chase it
// lost still leads it to where you actually went. Prints fade after PRINT_TTL
// seconds, and on hard ground (surface.js — shed floor now, pond ice / rock
// later) nothing is stamped, so cutting across it leaves the yeti no trail.
//
// Off-React singleton, same pattern as threat.js / decoy.js / shelter.js:
// Footprints.jsx stamps and ages the ring and redraws the mesh from it every
// frame; Yeti.jsx reads it when a search begins. A fixed-capacity ring, so it
// allocates nothing after mount.

export const TRAIL_CAPACITY = 80
export const PRINT_SPACING = 1.3 // metres of travel between successive prints
export const PRINT_TTL = 13 // seconds from freshly stamped to fully faded

function makeSlot() {
  return { x: 0, z: 0, rot: 0, age: 0, live: false }
}

export const trail = {
  slots: Array.from({ length: TRAIL_CAPACITY }, makeSlot),
  head: 0, // slot the next print writes to; also the oldest live print
  lastX: 0, // last stamped print, for the spacing check
  lastZ: 0,
  seeded: false, // false until the first print of a run
}

// Fresh scene (mount / restart): drop every print so the last run's trail can't
// linger into this one.
export function resetTrail() {
  for (const s of trail.slots) {
    s.live = false
    s.age = 0
  }
  trail.head = 0
  trail.lastX = 0
  trail.lastZ = 0
  trail.seeded = false
}

// Stamp a print at (x, z) once we've travelled PRINT_SPACING since the last one.
// Returns true when a print was actually laid.
export function stampPrint(x, z) {
  if (trail.seeded) {
    const dx = x - trail.lastX
    const dz = z - trail.lastZ
    if (dx * dx + dz * dz < PRINT_SPACING * PRINT_SPACING) return false
    const s = trail.slots[trail.head]
    s.x = x
    s.z = z
    s.rot = Math.atan2(dx, dz) // aim the boot-scuff along the stride
    s.age = 0
    s.live = true
    trail.head = (trail.head + 1) % TRAIL_CAPACITY
  } else {
    // First print of the run — no previous point to face away from.
    const s = trail.slots[trail.head]
    s.x = x
    s.z = z
    s.rot = 0
    s.age = 0
    s.live = true
    trail.head = (trail.head + 1) % TRAIL_CAPACITY
  }
  trail.lastX = x
  trail.lastZ = z
  trail.seeded = true
  return true
}

// Age every live print; retire the ones past PRINT_TTL.
export function ageTrail(delta) {
  for (const s of trail.slots) {
    if (!s.live) continue
    s.age += delta
    if (s.age >= PRINT_TTL) s.live = false
  }
}

// Live prints, oldest → newest. Allocates — call it once when a search starts,
// not every frame.
export function livePrints() {
  const out = []
  for (let i = 0; i < TRAIL_CAPACITY; i++) {
    const s = trail.slots[(trail.head + i) % TRAIL_CAPACITY]
    if (s.live) out.push({ x: s.x, z: s.z })
  }
  return out
}

// The path an investigating yeti at (x, z) should walk: from the live print
// nearest it through to the newest (freshest, closest to your last-known spot).
// Empty when there's nothing to follow — the yeti then falls back to searching
// the last-known point directly, exactly as it did before 7.3.
export function trailToFollow(x, z) {
  const prints = livePrints() // oldest → newest
  if (prints.length === 0) return []
  let best = 0
  let bestD2 = Infinity
  for (let i = 0; i < prints.length; i++) {
    const dx = prints[i].x - x
    const dz = prints[i].z - z
    const d2 = dx * dx + dz * dz
    if (d2 < bestD2) {
      bestD2 = d2
      best = i
    }
  }
  return prints.slice(best)
}
