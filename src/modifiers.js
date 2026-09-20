// Step 8.5: per-level modifiers — occasional twist levels layered on top of
// the linear 6.6 ramp. One at a time, rolled fresh when a level starts:
//
//  - 'blizzard': vision cut. World.jsx pulls fog distance in for the level,
//    the same knob 7.16's sleet already turns for a weather event, just held
//    for the whole level instead of a timed window.
//  - 'blackout': no HUD. Hud.jsx drops the informational chrome (vignette,
//    lunge frame, bars, counters) — never the touch controls, which stay
//    fully visible and usable; a modifier that makes the phone unplayable
//    would be a bug, not a twist.
//  - 'double': embers are worth double this level. store.js's collectItem
//    reads it directly; nothing here but the label.
//
// Pure and framework-free, like feeding.js's rollFeed, so the roll is easy to
// test and cheap to call once per level. Rolled off dailyRandom (8.4) at the
// call site so a level's twist is part of what a daily seed makes comparable.
export const MODIFIERS = ['blizzard', 'blackout', 'double']

const MIN_LEVEL = 2 // level 1 stays a clean, twist-free introduction
const MODIFIER_CHANCE = 0.35 // most levels play straight; this is a garnish

export function rollModifier(level, rng = Math.random) {
  if (level < MIN_LEVEL) return null
  if (rng() >= MODIFIER_CHANCE) return null
  return MODIFIERS[Math.floor(rng() * MODIFIERS.length)]
}
