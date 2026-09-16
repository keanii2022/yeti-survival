// Step 7.3 — what's underfoot at a world point.
//
// The footprint trail (footprints.js) only marks snow. Stepping onto hard
// ground leaves nothing for an investigating yeti to follow, so cutting across
// it is how you break the trail. 7.13 adds the frozen pond as the second kind
// of hard ground (bare rock for 7.15 is still to come) — same "counts as
// hard" treatment as a shed floor, no changes needed on the trail side.
//
// Pure and R3F-free like sheds.js: both lists are the fixed-seed ones every
// consumer shares, cached on first use so a per-frame call allocates nothing.

import { generateSheds, pointInsideShed } from './sheds.js'
import { generatePonds, pointInsidePond } from './pond.js'

let sheds = null
let ponds = null

// 'snow' everywhere except inside a shed or over pond ice, both 'hard'.
export function surfaceAt(x, z) {
  if (!sheds) sheds = generateSheds()
  if (!ponds) ponds = generatePonds()
  for (let i = 0; i < sheds.length; i++) {
    if (pointInsideShed(sheds[i], x, z)) return 'hard'
  }
  for (let i = 0; i < ponds.length; i++) {
    if (pointInsidePond(ponds[i], x, z)) return 'hard'
  }
  return 'snow'
}

// Test seam: pin the shed / pond lists (or pass null to fall back to the real
// generator on the next call).
export function _setSheds(list) {
  sheds = list
}

export function _setPonds(list) {
  ponds = list
}
