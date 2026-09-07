// Step 6.6: the run is a climb through LEVEL_COUNT levels instead of one fixed
// scatter of six embers. This module owns the escalation curve — every number
// that ramps with depth — so the Yeti AI, the ember spawner, the store and the
// audio bed all read one source of truth.
//
// Each level = clear `levelTarget` embers (spawned off-screen around the
// player), then a calm INTERLUDE_SECONDS breather, then the next level spawns
// and the yeti re-aggros. Clear LEVEL_COUNT levels for the win screen; past
// that the run continues in endless "nightfall" mode (no interludes, the curve
// keeps climbing — `levelParams` is defined for any level).

// Playtest walked this 10 → 6 → 8. Six proved the loop was fun and left the
// player wanting more climb; eight adds two levels of new, harder territory off
// the same curve (L7–8: near-instant commit, detection past 30u, the wander
// leash tight around you) without stretching the ramp thinner. Everything keyed
// to LEVEL_COUNT or the level number tracks the change automatically.
export const LEVEL_COUNT = 8

// Seconds of calm between clearing a level and the next wave. Warmth stops
// draining, the yeti is pushed to a far wander, the music strips to the light
// bed, and the HUD shows the "LEVEL N" card. Trimmed from 12 — long enough to
// breathe, short enough not to drag.
export const INTERLUDE_SECONDS = 8

// Nightfall (unlocked by clearing all 10) replays the same 10-level climb, but
// every level is pinned this many rungs higher on the curve — nightfall L1
// already bites like normal L5, and from nightfall L6 on it holds at L10, the
// hardest you've already beaten. It never climbs past that: the point is a
// tougher run, not a yeti you can't run from. Interludes and the win screen
// still happen; it just ends on its own "night is over" card.
export const NIGHTFALL_OFFSET = 4

// The curve rung a run-level actually plays at, given the mode.
export function effectiveLevel(level, nightfall) {
  const L = Math.max(1, level)
  return nightfall ? Math.min(LEVEL_COUNT, L + NIGHTFALL_OFFSET) : L
}

// Embers to clear per level: 7 through L3, 8 from L4 on. Bumped from 6 in a
// playtest pass — more embers early means more warmth in the bank and a fuller
// arena to read, without making a level much longer.
export function levelTarget(level) {
  return Math.min(8, 6 + Math.ceil(Math.max(1, level) / 3))
}

// Player reference speeds (Player.jsx): WALK 6, SPRINT 10. The whole curve is
// shaped around those two. Through L4 the sustained chase sits between them, so
// a straight sprint still opens a gap — the margin just shrinks. From L5 the
// sustained speed creeps toward sprint but this module clamps it strictly
// below: past L5 you survive by breaking line of sight, not by out-running him,
// and the dial shifts onto detection range, commit time and the wander leash.
const SPRINT = 10

export function levelParams(level) {
  const L = Math.max(1, level)

  // Sustained chase speed: 5.2 at L1 (a smudge under the old 6.1 value of 5.4,
  // from playtest — a hair more room to walk away early), ~9.0 by L5, then a
  // slow creep that the min() pins below sprint forever.
  const chaseSpeed =
    L <= 5 ? 5.2 + (L - 1) * 0.95 : Math.min(SPRINT - 0.3, 9.0 + (L - 5) * 0.12)

  // Close-range lunge (6.1's BURST): 7 at L1, climbing a shade faster than the
  // sustained speed so a corner is always deadlier than the open, and clamped
  // just below sprint so a desperate dash isn't mathematically hopeless.
  const burstSpeed = Math.min(SPRINT - 0.15, 7 + (L - 1) * 0.55)

  // Detection radius — the main dial once speed is capped. Gentle creep to L4,
  // then it opens up fast.
  const detectRadius = L <= 4 ? 18 + (L - 1) * 1.2 : 21.6 + (L - 4) * 2.2

  // 6u of hysteresis, kept from 6.11 so the chase/search flip can't chatter at
  // the boundary; re-spot range sits inside detection so a shaken chase stays
  // shaken unless he nearly walks into you.
  const loseRadius = detectRadius + 6
  const reacquireRadius = detectRadius - 4

  // Seconds the player must stay inside detectRadius before the yeti commits to
  // the chase. 0.7s at L1 — you can dart across his sightline and get away with
  // it — shrinking to an instant lock by L9.
  const commitDelay = Math.max(0, 0.7 - (L - 1) * 0.09)

  // How long the yeti hunts your last-known spot before giving up (6.11's
  // SEARCH_TIME baseline was 4). Longer every level, capped so a search can't
  // outlast the warmth clock.
  const searchTime = Math.min(11, 4 + (L - 1) * 0.8)

  // Idle-wander leash: at L1 he roams the whole 120u arena; deep levels he
  // lurks within this radius of your last position, so there's nowhere quiet.
  const wanderRadius = Math.max(26, 130 - (L - 1) * 11)

  // 6.12 shed checks: how often (seconds) the idle yeti breaks off to walk over
  // and look a shed over, and how long he lingers by the door once there. L1 is
  // a slow ~28s patrol and a brief 2s look you can wait out from inside; by the
  // deep levels he's back at your door every ~10s and holds it ~4s — hiding
  // stops being a refuge and turns into a stopwatch. Kept short on purpose: a
  // long guard just reads as the yeti being stuck.
  const shedCheckInterval = Math.max(10, 28 - (L - 1) * 2.6)
  const shedLookTime = Math.min(4, 2 + (L - 1) * 0.3)

  return {
    chaseSpeed,
    burstSpeed,
    detectRadius,
    loseRadius,
    reacquireRadius,
    commitDelay,
    searchTime,
    wanderRadius,
    shedCheckInterval,
    shedLookTime,
  }
}
