// Step 6.11: a reusable "go look at a spot" behaviour for the yeti.
//
// When the yeti loses the player it no longer snaps straight back to idle
// wander — it walks to where it last saw them and pokes around nearby for a few
// seconds before giving up. That motion ("travel to a point of interest, then
// search the area around it") is factored out here so the later hide-and-seek
// steps can drive the exact same behaviour off different points and timings:
//   - 6.12: the yeti walking over to check the nearest shed
//   - 6.14: the yeti diverting to a thrown decoy
//
// 7.3 threads a footprint trail through the travel phase: given an ordered list
// of trail points, the yeti walks them in sequence on its way to the point of
// interest instead of beelining there. Still not pathfinding — it steers
// straight at each point, the trail just gives it a set of points to string
// together.
//
// Pure and framework-free: it holds no three.js objects and mutates nothing
// except the probe you hand it, so it's cheap to run every frame and easy to
// test in isolation.

// Behaviour shape, shared by every caller. "How long to search" is passed in
// per call (beginProbe's searchTime) because 6.6 scales it with the level.
const ARRIVE_DIST = 1.6 // close enough to count as "reached the point"
const SEARCH_RADIUS = 7 // how far the nearby pokes stray from the point
const TRAVEL_SPEED = 3.6 // a purposeful stalk toward the last-known spot
const LOOK_SPEED = 1.9 // a slow prowl while casting around the area
const LOOK_DWELL_MIN = 1.0 // seconds spent heading to each nearby poke point
const LOOK_DWELL_VAR = 1.3
const DEFAULT_SEARCH_TIME = 5
// Safety net: if the point can't actually be reached (walled off — 6.12 sends
// the yeti to a shed door he then can't push past), drop into the look phase
// anyway after this long so the probe still ends instead of grinding forever.
const TRAVEL_TIMEOUT = 8

// A probe is the per-yeti scratch state for one investigation. Make one at mount
// and reuse it; beginProbe re-arms it.
export function createProbe() {
  return {
    active: false,
    phase: 'travel', // 'travel' to the point, then 'look' around it
    targetX: 0,
    targetZ: 0,
    lookX: 0,
    lookZ: 0,
    lookTimer: 0,
    searchTimer: 0,
    travelTimer: 0,
    trail: null, // 7.3: ordered [{x,z}] to walk before closing on the target
    trailIdx: 0,
  }
}

// Arm the probe: walk `trail` (if any), then go to (x, z), then search nearby
// for `searchTime` seconds. `trail` is an ordered list of {x, z} points — the
// 7.3 footprint path, oldest reachable print first — or null / empty to beeline
// straight to (x, z) as the probe did before 7.3.
export function beginProbe(probe, x, z, searchTime = DEFAULT_SEARCH_TIME, trail = null) {
  probe.active = true
  probe.phase = 'travel'
  probe.targetX = x
  probe.targetZ = z
  probe.lookX = x
  probe.lookZ = z
  probe.lookTimer = 0
  probe.searchTimer = searchTime
  probe.travelTimer = TRAVEL_TIMEOUT
  probe.trail = trail && trail.length ? trail : null
  probe.trailIdx = 0
}

// Uniform point inside SEARCH_RADIUS of the target, clamped to the arena.
function pickLookPoint(probe, rng, bound) {
  const angle = rng() * Math.PI * 2
  const radius = SEARCH_RADIUS * Math.sqrt(rng())
  let x = probe.targetX + Math.cos(angle) * radius
  let z = probe.targetZ + Math.sin(angle) * radius
  if (bound != null) {
    x = Math.max(-bound, Math.min(bound, x))
    z = Math.max(-bound, Math.min(bound, z))
  }
  probe.lookX = x
  probe.lookZ = z
  probe.lookTimer = LOOK_DWELL_MIN + rng() * LOOK_DWELL_VAR
}

// Advance one frame. `pos` is the yeti's {x, z}. `opts.rng` defaults to
// Math.random; `opts.bound` (arena half-extent) keeps the pokes off the wall.
// Returns { done, moving, speed, aimX, aimZ }: steer toward (aimX, aimZ) at
// `speed` this frame, and switch back to wander once `done` is true.
export function stepProbe(probe, pos, delta, opts = {}) {
  if (!probe.active) return { done: true, moving: false, speed: 0, aimX: pos.x, aimZ: pos.z }

  const rng = opts.rng || Math.random
  const bound = opts.bound

  if (probe.phase === 'travel') {
    probe.travelTimer -= delta

    // 7.3: consume any trail points already within reach, then aim at the next
    // one; once the trail's walked, aim at the real point of interest. Arriving
    // there (or the travel timeout firing) tips into the look phase.
    while (probe.trail && probe.trailIdx < probe.trail.length) {
      const n = probe.trail[probe.trailIdx]
      const ndx = n.x - pos.x
      const ndz = n.z - pos.z
      if (ndx * ndx + ndz * ndz > ARRIVE_DIST * ARRIVE_DIST) break
      probe.trailIdx++
    }
    const following = probe.trail && probe.trailIdx < probe.trail.length
    const tx = following ? probe.trail[probe.trailIdx].x : probe.targetX
    const tz = following ? probe.trail[probe.trailIdx].z : probe.targetZ
    const dx = tx - pos.x
    const dz = tz - pos.z

    if ((!following && dx * dx + dz * dz <= ARRIVE_DIST * ARRIVE_DIST) || probe.travelTimer <= 0) {
      probe.phase = 'look'
      pickLookPoint(probe, rng, bound)
    } else {
      return { done: false, moving: true, speed: TRAVEL_SPEED, aimX: tx, aimZ: tz }
    }
  }

  // 'look': burn down the search budget, wandering between nearby poke points.
  probe.searchTimer -= delta
  if (probe.searchTimer <= 0) {
    probe.active = false
    return { done: true, moving: false, speed: 0, aimX: pos.x, aimZ: pos.z }
  }

  probe.lookTimer -= delta
  const dx = probe.lookX - pos.x
  const dz = probe.lookZ - pos.z
  if (probe.lookTimer <= 0 || dx * dx + dz * dz < 1) {
    pickLookPoint(probe, rng, bound)
  }
  return { done: false, moving: true, speed: LOOK_SPEED, aimX: probe.lookX, aimZ: probe.lookZ }
}
