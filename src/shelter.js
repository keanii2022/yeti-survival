// Step 6.12: per-frame shed readout, same off-React singleton pattern as
// threat.js / greenEmber.js. Updating this 60x a second in the zustand store
// would thrash every subscriber, so the pieces that need it poll this instead.
//
//  - `inside` / `shedIndex`: the player is currently tucked inside shed N.
//    Sheds.jsx writes it; Yeti.jsx reads it to go blind, Survival.jsx to slow
//    the warmth drain, the HUD to show the "hidden" cue.
//  - `yetiCheckIndex` / `yetiCheckDist`: the shed the yeti is walking over to
//    check right now (-1 / Infinity when he isn't). Yeti.jsx writes it; Sound.jsx
//    turns it into the approaching-footfalls tell, the HUD into "he's at the
//    door".
export const shelter = {
  inside: false,
  shedIndex: -1,
  yetiCheckIndex: -1,
  yetiCheckDist: Infinity,
}

// Wipe it back to "nobody's hiding, nobody's checking" — called on a fresh scene
// (mount / restart) so a previous run can't leave the flags stuck on.
export function resetShelter() {
  shelter.inside = false
  shelter.shedIndex = -1
  shelter.yetiCheckIndex = -1
  shelter.yetiCheckDist = Infinity
}
