// Step 8.1: distracted feeding.
//
// Early in a level there's a chance the yeti breaks off his idle wander,
// ambles over to the ember nearest him, and stops there — fully blind for a
// few seconds. He doesn't react to the player at all while he eats (no
// detection check, same as 7.8's poop divert), so an ember right next to him
// is safe to grab as long as you don't walk into him — but he's standing
// right where you need to go, which is the tension the step is chasing.
//
// 8.7: the first playtest never noticed it — it only rolled once a level was
// down to its last 3 embers, at 60%, and while he ate there was nothing to
// see or hear. Now it rolls a few seconds into every level (FEED_DELAY_*) at
// much higher odds, and Yeti.jsx / Sound.jsx give him a hunched eating pose
// and a crunching / snuffling sound you can hear from well outside his sight.
//
// One roll per level: once the level's feed delay has run down, rollFeed
// decides once (feed or skip) and Yeti.jsx doesn't ask again until the next
// level's wave forms.
//
// Pure and framework-free, like investigate.js, so it's cheap every frame
// and easy to test in isolation.

export const FEED_DELAY_MIN = 5 // seconds into a level before he can break off to feed
export const FEED_DELAY_VAR = 7 // ...plus up to this much more, rolled per level
export const FEED_CHANCE = 0.85 // odds he actually takes the bait once the delay is up
const FEED_TRAVEL_SPEED = 2.4 // an unhurried amble — slower than idle wander, he's not hunting
const FEED_DURATION = 6 // seconds spent stationary and blind once he arrives
const ARRIVE_DIST = 1.6

export function createFeed() {
  return { active: false, phase: 'travel', x: 0, z: 0, timer: 0 }
}

// How long into a fresh level before the feed roll happens.
export function feedDelay(rng = Math.random) {
  return FEED_DELAY_MIN + rng() * FEED_DELAY_VAR
}

// Arm the feed: walk to (x, z) — the ember nearest him — then stop.
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

// The once-per-level roll. `field` is the embers.js readout (level,
// remaining, nearX/Z); `wait` is how much of the level's feed delay is still
// left to run. Returns 'pending' while the delay hasn't run out or there's no
// live wave to feed on (keep checking next frame), or the resolved 'feed' /
// 'skip' — the caller latches the level once it sees anything but 'pending'
// so the roll only ever fires once per level.
export function rollFeed(level, field, wait, rng = Math.random) {
  if (field.level !== level || field.remaining <= 0 || wait > 0) return 'pending'
  return rng() < FEED_CHANCE ? 'feed' : 'skip'
}
