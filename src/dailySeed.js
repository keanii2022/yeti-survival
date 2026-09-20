// Step 8.4: daily seed. One fixed seed per calendar day (the player's local
// date), so two people playing on the same day see the same yeti spawn, the
// same first ember wave, the same weather timing — everything gameplay-shaping
// that this module's `dailyRandom()` feeds, in place of the raw Math.random()
// those systems used to call directly. No persistent leaderboard (that's
// explicitly out of scope) — the point is just "we played the same layout
// today," compared informally.
//
// Purely cosmetic randomness (snow particle jitter, tree color tint, screen
// shake, audio synthesis noise) is deliberately left on plain Math.random —
// seeding it would buy nothing since nobody compares those, and it would only
// add draws to the shared stream that make the gameplay-relevant sequence
// harder to reason about.
//
// Like a chase or a wander diverging the instant two players make different
// choices, the shared seed only holds two runs in lockstep up to the point
// their play (and so their draw order) diverges — same as any seeded-RNG
// daily challenge (Spelunky, NetHack, and the like). That's expected, not a
// bug: the value is in the identical starting conditions, not a guarantee
// that skill stops mattering.

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A plain YYYYMMDD integer in local time — stable across timezones for the
// player it's running for, which is all a family "did you get today's seed"
// comparison needs.
export function todaySeedValue(date = new Date()) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

let gen = mulberry32(todaySeedValue())

// Drop-in Math.random() replacement for every run-shaping roll this build
// wants comparable day to day.
export function dailyRandom() {
  return gen()
}

// Re-rolls the generator from today's date. Called at the top of every fresh
// run (store.js's reset / startNightfall) so a second run today replays the
// same sequence of draws from the start, rather than picking up wherever the
// previous run's generator happened to land.
export function reseedDaily(date = new Date()) {
  gen = mulberry32(todaySeedValue(date))
}
