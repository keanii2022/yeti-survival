// Step 7.16 — weather events: discrete set-pieces, not a running system. One
// event at a time, picked and pointed at random, holding for a fixed window
// with a short ramp in/out so it reads as a gust arriving and dying down
// rather than a hard cut:
//
//  - gust: a directional wind. Snow.jsx leans the flurry with it so it's
//    visible before it bites; Survival.jsx reads the heading against the
//    player's own movement and drains warmth faster while walking into it.
//  - sleet: no direction, just closes fog distance down for the window —
//    World.jsx scales its usual day-cycle fog by `sleetAmount`.
//
// Same off-React singleton shape as shelter.js / campfire.js: Snow.jsx (always
// mounted while playing) ticks this once a frame; everyone else only reads.

export const GUST_INTERVAL_MIN = 22 // seconds of calm before a gust can roll
export const GUST_INTERVAL_MAX = 40
export const GUST_DURATION = 6
// Extra warmth-drain multiplier at full strength while walking straight into
// a gust; tapers to 1x moving across or with it (see `intoWindFactor`).
export const GUST_DRAIN_MULT = 2.2

export const SLEET_INTERVAL_MIN = 30
export const SLEET_INTERVAL_MAX = 55
export const SLEET_DURATION = 9
// Fog near/far scale at full sleet — under 1 pulls the world in around you.
export const SLEET_VISION_MULT = 0.45

const RAMP = 2 // seconds to ease an event's strength in and back out

export const weather = {
  type: null, // 'gust' | 'sleet' | null
  windX: 0,
  windZ: -1,
  gustAmount: 0, // 0..1, ramped
  sleetAmount: 0, // 0..1, ramped
}

let elapsed = 0
let nextIn = rollInterval()

function rollInterval() {
  return GUST_INTERVAL_MIN + Math.random() * (GUST_INTERVAL_MAX - GUST_INTERVAL_MIN)
}

// Trapezoid: 0 at the very start/end of `duration`, 1 across the middle, with
// `ramp`-second slopes on either side.
function envelope(t, duration, ramp) {
  return Math.max(0, Math.min(1, t / ramp, (duration - t) / ramp))
}

// How much a movement vector counts as "into" the wind: 1 walking straight
// upwind, 0 crossing or moving with it. `mx`/`mz` need not be normalized;
// a near-zero (standing still) vector reads as 0.
export function intoWindFactor(mx, mz) {
  const len = Math.hypot(mx, mz)
  if (len < 1e-4) return 0
  // Wind (windX, windZ) points where it's blowing TO, so moving upwind is the
  // negative of that heading.
  return Math.max(0, -(mx / len) * weather.windX - (mz / len) * weather.windZ)
}

export function resetWeather() {
  weather.type = null
  weather.windX = 0
  weather.windZ = -1
  weather.gustAmount = 0
  weather.sleetAmount = 0
  elapsed = 0
  nextIn = rollInterval()
}

// Advance the schedule and the live event's envelope. Call once a frame while
// playing; a paused/idle frame should simply not call it, freezing the clock.
export function tickWeather(delta) {
  if (weather.type) {
    elapsed += delta
    const duration = weather.type === 'gust' ? GUST_DURATION : SLEET_DURATION
    if (elapsed >= duration) {
      weather.type = null
      weather.gustAmount = 0
      weather.sleetAmount = 0
      nextIn = rollInterval()
      return
    }
    const amt = envelope(elapsed, duration, RAMP)
    if (weather.type === 'gust') weather.gustAmount = amt
    else weather.sleetAmount = amt
    return
  }
  nextIn -= delta
  if (nextIn > 0) return
  weather.type = Math.random() < 0.5 ? 'gust' : 'sleet'
  elapsed = 0
  if (weather.type === 'gust') {
    const ang = Math.random() * Math.PI * 2
    weather.windX = Math.sin(ang)
    weather.windZ = Math.cos(ang)
  }
}

// Test seam: drop straight into an event at a given point in its envelope,
// skipping the random wait/pick so ramp behaviour is deterministic to test.
export function _forceEvent(type, at = 0, windX = 0, windZ = -1) {
  weather.type = type
  weather.windX = windX
  weather.windZ = windZ
  elapsed = at
  const duration = type === 'gust' ? GUST_DURATION : SLEET_DURATION
  const amt = envelope(at, duration, RAMP)
  if (type === 'gust') weather.gustAmount = amt
  else weather.sleetAmount = amt
}
