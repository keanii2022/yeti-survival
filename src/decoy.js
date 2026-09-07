// Step 6.14: the thrown decoy — an off-React readout, same singleton pattern as
// threat.js / greenEmber.js / shelter.js. Updating it in the zustand store 60x
// a second would thrash every subscriber, so the two pieces that need it poll
// this instead.
//
// Decoy.jsx writes it the frame you throw: a fresh landing point and a bumped
// `throwId`. Yeti.jsx reads it every frame, and the first time it sees a
// `throwId` it hasn't acted on it drops whatever it's doing — a live chase
// included — and diverts to investigate (x, z), reusing the 6.11 probe. The
// yeti clears `live` itself once that investigation ends; Decoy.jsx also
// force-clears it after a max lifetime so a decoy thrown into the interlude (or
// otherwise never reached) can't leave the flag stuck on.
export const decoy = {
  throwId: 0, // bumped per throw; the yeti latches the id it has diverted for
  x: 0,
  z: 0,
  live: false, // a decoy is out there and still worth walking over to
}

// Wipe it on a fresh scene (mount / restart) so a previous run's last throw
// can't linger into the next one.
export function resetDecoy() {
  decoy.throwId = 0
  decoy.x = 0
  decoy.z = 0
  decoy.live = false
}
