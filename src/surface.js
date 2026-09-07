// Step 7.3 — what's underfoot at a world point.
//
// The footprint trail (footprints.js) only marks snow. Stepping onto hard
// ground leaves nothing for an investigating yeti to follow, so cutting across
// it is how you break the trail. Right now the only hard ground is a shed floor;
// 7.13 (frozen pond) and 7.15 lean on this same lookup — pond ice and bare rock
// register as 'hard' here and the trail code needs no changes.
//
// Pure and R3F-free like sheds.js: the shed list is the fixed-seed one every
// consumer shares, cached on first use so a per-frame call allocates nothing.

import { generateSheds, pointInsideShed } from './sheds.js'

let sheds = null

// 'snow' everywhere except inside a shed, where the plank floor is 'hard'.
export function surfaceAt(x, z) {
  if (!sheds) sheds = generateSheds()
  for (let i = 0; i < sheds.length; i++) {
    if (pointInsideShed(sheds[i], x, z)) return 'hard'
  }
  return 'snow'
}

// Test seam: pin the shed list (or pass null to fall back to generateSheds on
// the next call).
export function _setSheds(list) {
  sheds = list
}
