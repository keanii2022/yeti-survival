// Step 8.3: the Guardian — the second yeti, active from effective level 5
// onward (levels.js caps effectiveLevel at LEVEL_COUNT, so in practice this is
// just L5 and L6 of the curve, nightfall included since its offset already
// starts a run there).
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

// The Guardian's own short ramp: effectiveLevel only ever hands it 5 or 6
// (levels.js pins nightfall's offset so it never climbs further), so this is
// a straight lerp between an L5 floor and an L6-and-up ceiling rather than a
// long curve like levelParams.
export function guardianParams(curveLevel) {
  const t = Math.min(1, Math.max(0, curveLevel - GUARDIAN_MIN_LEVEL))
  return {
    // Wider than its own patrol turf on purpose — you're spotted well before
    // you're standing on the ember, which is the warning that it's his turf.
    aggroRadius: 22 + t * 8,
    // Tight leash on the wander — a sentinel holding a post, not roaming.
    patrolRadius: 16 - t * 4,
    // "Peels off to chase briefly before returning to post" — a hard cap, not
    // a lose-sight condition like the Hunter's search state.
    chaseCap: 3 + t * 3,
    // Deliberately a notch under the Hunter's own sustained speed at these
    // levels (levels.js's chaseSpeed is ~9 by L5) — the Hunter is still the
    // real threat; the Guardian just makes lingering near the ember costly.
    speed: 5.6 + t,
  }
}

export function resetGuardian() {
  guardian.present = false
  guardian.x = 0
  guardian.z = 0
  guardian.mode = 'patrol'
  guardian.distance = Infinity
}
