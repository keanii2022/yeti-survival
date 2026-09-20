// Step 8.1: distracted feeding.
//
// Once a level's ember wave has thinned to its final handful, there's a
// chance the yeti breaks off his idle wander, ambles over to where they're
// clustered, and stops there — fully blind for a few seconds. He doesn't
// react to the player at all while this runs (no detection check, same as
// 7.8's poop divert), so the last few embers of a level are safe to grab as
// long as you don't walk into him — but he's standing right where you need
// to go, which is the tension the step is chasing.
//
// One roll per level: as soon as the ember field thins to FEED_CLUSTER_SIZE
// or fewer, rollFeed decides once (feed or skip) and Yeti.jsx doesn't ask
// again until the next level's wave forms.
//
// Pure and framework-free, like investigate.js, so it's cheap every frame
// and easy to test in isolation.

export const FEED_CLUSTER_SIZE = 3 // embers remaining at or below this counts as "the final cluster"
export const FEED_CHANCE = 0.6 // odds he actually takes the bait once the cluster forms
const FEED_TRAVEL_SPEED = 2.4 // an unhurried amble — slower than idle wander, he's not hunting
const FEED_DURATION = 6 // seconds spent stationary and blind once he arrives
const ARRIVE_DIST = 1.6

export function createFeed() {
  return { active: false, phase: 'travel', x: 0, z: 0, timer: 0 }
}

// Arm the feed: walk to (x, z) — the ember cluster's centroid — then stop.
export function beginFeed(feed, x, z) {
  feed.active = true
  feed.phase = 'travel'
  feed.x = x
  feed.z = z
  feed.timer = 0
}

// Advance one frame. `pos` is the yeti's {x, z}. Returns
// { done, moving, speed, aimX, aimZ }: steer toward (aimX, aimZ) at `speed`
// while moving; once `done`, the caller drops back to idle wander.
export function stepFeed(feed, pos, delta) {
  if (!feed.active) return { done: true, moving: false, speed: 0, aimX: pos.x, aimZ: pos.z }

  if (feed.phase === 'travel') {
    const dx = feed.x - pos.x
    const dz = feed.z - pos.z
    if (dx * dx + dz * dz <= ARRIVE_DIST * ARRIVE_DIST) {
      feed.phase = 'eat'
      feed.timer = FEED_DURATION
    } else {
      return { done: false, moving: true, speed: FEED_TRAVEL_SPEED, aimX: feed.x, aimZ: feed.z }
    }
  }

  feed.timer -= delta
  if (feed.timer <= 0) {
    feed.active = false
    return { done: true, moving: false, speed: 0, aimX: pos.x, aimZ: pos.z }
  }
  return { done: false, moving: false, speed: 0, aimX: pos.x, aimZ: pos.z }
}

// The once-per-level roll. `field` is the embers.js readout (level, remaining,
// clusterX/Z). Returns 'pending' while the wave hasn't thinned to the final
// cluster yet (keep checking next frame), or the resolved 'feed' / 'skip' —
// the caller latches the level once it sees anything but 'pending' so the
// roll only ever fires once per level.
export function rollFeed(level, field, rng = Math.random) {
  if (field.level !== level || field.remaining <= 0 || field.remaining > FEED_CLUSTER_SIZE) {
    return 'pending'
  }
  return rng() < FEED_CHANCE ? 'feed' : 'skip'
}
