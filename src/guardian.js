// Step 8.3: the Guardian — the second yeti. 8.10 brought it in from level 1
// (it used to wait for effective level 5, which most runs never reached), on
// every difficulty, and re-spread its ramp across the climb: a gentle sentinel
// at L1 growing into its original 8.3 strength over the last two levels.
// 8.6 removed nightfall's level ceiling, so effectiveLevel can climb well
// past 6 in an endless run; guardianParams' third lerp (t2 below) is what
// keeps the Guardian escalating gently alongside that instead of flatlining
// at its old L6 values forever.
//
// Unlike the Hunter (Yeti.jsx — the original AI, unchanged, running its own
// full 6.6-11 dial), the Guardian has one job: hold a patrol post near the
// green ember and only give chase briefly before returning to it. It has none
// of the Hunter's richness — no search memory, no shed patrols, no feeding, no
// roar — on purpose, so the two read as different kinds of threat: a hunter
// that commits, and a sentinel that punishes lingering in its turf.
//
// Same off-React singleton pattern as threat.js: Guardian.jsx writes this
// every frame; GreenEmber.jsx reads `present`/`x`/`z` to anchor the ember on
// the Guardian's post instead of the Hunter once one exists, and Sound.jsx
// folds `distance`/`mode` into the shared proximity/danger readout.
import { difficultyMods } from './difficulty.js'

export const guardian = {
  present: false, // true once curveLevel >= GUARDIAN_MIN_LEVEL and the run is live
  x: 0,
  z: 0,
  mode: 'patrol', // 'patrol' | 'chase' | 'return'
  distance: Infinity, // to the player
}

// 8.10: every run, from the first level. Kept as a knob (Guardian.jsx still
// gates on it) in case playtest wants him held back a level or two.
export const GUARDIAN_MIN_LEVEL = 1

// Where the Guardian reaches the strength it used to arrive at under 8.3.
// From here to one level above it is the original 8.3 ramp, unchanged.
export const GUARDIAN_FULL_LEVEL = 5

// The Guardian's own ramp, in three lerps:
//   t0 — 8.10's gentle climb from GUARDIAN_MIN_LEVEL up to the old 8.3 floor
//        at GUARDIAN_FULL_LEVEL;
//   t1 — the original 8.3 tuning, that floor up to its L6 ceiling;
//   t2 — a slower, bounded creep past that, which only ever engages in
//        nightfall's endless climb (8.6).
// Takes a difficulty like levelParams does: now that the Guardian is in every
// run, 'medium' / 'easy' pull in its speed, aggro range and commit delay by
// the same factors as the Hunter's, so it stays a notch under him in every
// mode. A bare guardianParams(L) reads the raw HARD numbers.
export function guardianParams(curveLevel, difficulty) {
  const mod = difficultyMods(difficulty)
  const t0 = Math.min(
    1,
    Math.max(0, (curveLevel - GUARDIAN_MIN_LEVEL) / (GUARDIAN_FULL_LEVEL - GUARDIAN_MIN_LEVEL)),
  )
  const t1 = Math.min(1, Math.max(0, curveLevel - GUARDIAN_FULL_LEVEL))
  const t2 = Math.max(0, curveLevel - (GUARDIAN_FULL_LEVEL + 1))
  return {
    // Wider than its own patrol turf on purpose — you're spotted well before
    // you're standing on the ember, which is the warning that it's his turf.
    aggroRadius: (16 + t0 * 6 + t1 * 8 + t2 * 1.4) * mod.detectRadius,
    // Tight leash on the wander — a sentinel holding a post, not roaming.
    // Floored well above zero: a patrol radius of 0 would just be a yeti
    // nailed to one spot, which reads as broken, not harder.
    patrolRadius: Math.max(8, 18 - t0 * 2 - t1 * 4 - t2 * 0.5),
    // "Peels off to chase briefly before returning to post" — a hard cap, not
    // a lose-sight condition like the Hunter's search state. Capped well
    // under the Hunter's full commitment even at the far end of the creep.
    chaseCap: Math.min(9, 2 + t0 + t1 * 3 + t2 * 0.6),
    // Deliberately a notch under the Hunter's own sustained speed at every
    // level (levels.js's chaseSpeed: 5.2 at L1, ~9 by L5) — the Hunter is
    // still the real threat; the Guardian just makes lingering near the ember
    // costly. Clamped below the player's own sprint (10) so it's never
    // unbeatable.
    speed: Math.min(9.3, 5.0 + t0 * 0.6 + t1 + t2 * 0.25) * mod.yetiSpeed,
    // Seconds inside the aggro ring before he commits. A beat shorter than
    // the Hunter's through the base climb — he's already alert to his own
    // turf — but still long enough at L1 to dart across the edge of it.
    // Holds at 8.3's flat 0.3 from GUARDIAN_FULL_LEVEL on.
    commitDelay: (0.6 - t0 * 0.3) * mod.commitDelay,
  }
}

export function resetGuardian() {
  guardian.present = false
  guardian.x = 0
  guardian.z = 0
  guardian.mode = 'patrol'
  guardian.distance = Infinity
}
