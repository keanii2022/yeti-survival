// Step 7.8: the thrown poop — same off-React singleton shape as decoy.js /
// duck.js. The difference is entirely in how Yeti.jsx reacts to it: a longer
// investigate window than the duck, and no reacquire out of it — he sniffs,
// recoils, and disengages regardless of how close you are, so it's a
// guaranteed window rather than a lure you can spoil by lingering nearby.
export const poop = {
  throwId: 0, // bumped per throw; the yeti latches the id it has diverted for
  x: 0,
  z: 0,
  live: false, // a poop is out there and still worth walking over to
}

// Wipe it on a fresh scene (mount / restart) so a previous run's last throw
// can't linger into the next one.
export function resetPoop() {
  poop.throwId = 0
  poop.x = 0
  poop.z = 0
  poop.live = false
}
