// Step 7.8: the thrown squeaky duck — an off-React readout, same singleton
// pattern as decoy.js (see that file for the fuller rationale on why this
// isn't just a zustand field: writing it 60x a second would thrash every
// subscriber, so Yeti.jsx polls this instead).
//
// Throwables.jsx writes it the frame you throw: a fresh landing point and a
// bumped `throwId`. Yeti.jsx reads it every frame, and the first time it sees
// a `throwId` it hasn't acted on it diverts to investigate (x, z) — a short,
// snappy lure (see DUCK_LOOK_TIME in Yeti.jsx) that it can snap back off of if
// you're still close when it arrives. The yeti clears `live` itself once that
// investigation ends; Throwables.jsx also force-clears it after a max lifetime
// so a duck thrown into the interlude (or otherwise never reached) can't leave
// the flag stuck on.
export const duck = {
  throwId: 0, // bumped per throw; the yeti latches the id it has diverted for
  x: 0,
  z: 0,
  live: false, // a duck is out there and still worth walking over to
}

// Wipe it on a fresh scene (mount / restart) so a previous run's last throw
// can't linger into the next one.
export function resetDuck() {
  duck.throwId = 0
  duck.x = 0
  duck.z = 0
  duck.live = false
}
