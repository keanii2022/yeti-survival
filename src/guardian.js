// Step 8.3: the Guardian — the second yeti, active from effective level 5
// onward (nightfall's offset already starts a run there — see levels.js).
// 8.6 removed nightfall's level ceiling, so effectiveLevel can climb well
// past 6 in an endless run; guardianParams' second lerp (t2 below) is what
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
export const guardian = {
  present: false, // true once curveLevel >= GUARDIAN_MIN_LEVEL and the run is live
  x: 0,
  z: 0,
  mode: 'patrol', // 'patrol' | 'chase' | 'return'
  distance: Infinity, // to the player
}

export const GUARDIAN_MIN_LEVEL = 5

// The Guardian's own ramp: a straight lerp between an L5 floor and an L6
// ceiling (t1) for the base game, same as the original 8.3 tuning — plus a
// slower, bounded creep past L6 (t2) that only ever engages in nightfall's
// endless climb (8.6), so a long run keeps getting harder instead of
// flatlining at its old ceiling forever.
export function guardianParams(curveLevel) {
  const t1 = Math.min(1, Math.max(0, curveLevel - GUARDIAN_MIN_LEVEL))
  const t2 = Math.max(0, curveLevel - (GUARDIAN_MIN_LEVEL + 1))
  return {
    // Wider than its own patrol turf on purpose — you're spotted well before
    // you're standing on the ember, which is the warning that it's his turf.
    aggroRadius: 22 + t1 * 8 + t2 * 1.4,
    // Tight leash on the wander — a sentinel holding a post, not roaming.
    // Floored well above zero: a patrol radius of 0 would just be a yeti
    // nailed to one spot, which reads as broken, not harder.
    patrolRadius: Math.max(8, 16 - t1 * 4 - t2 * 0.5),
    // "Peels off to chase briefly before returning to post" — a hard cap, not
    // a lose-sight condition like the Hunter's search state. Capped well
    // under the Hunter's full commitment even at the far end of the creep.
    chaseCap: Math.min(9, 3 + t1 * 3 + t2 * 0.6),
    // Deliberately a notch under the Hunter's own sustained speed at these
    // levels (levels.js's chaseSpeed is ~9 by L5) — the Hunter is still the
    // real threat; the Guardian just makes lingering near the ember costly.
    // Clamped below the player's own sprint (10) so it's never unbeatable.
    speed: Math.min(9.3, 5.6 + t1 + t2 * 0.25),
  }
}

export function resetGuardian() {
  guardian.present = false
  guardian.x = 0
  guardian.z = 0
  guardian.mode = 'patrol'
  guardian.distance = Infinity
}
