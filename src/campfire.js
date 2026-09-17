// Step 7.14 — campfires: a direct risk/reward on the warmth stat. Stand inside
// the glow and warmth regenerates instead of draining — but the firelight also
// gives you away: the yeti's detection radius balloons for as long as you're
// standing in it. Same fixed-seed placement shape as sheds.js / pond.js (one
// generator every consumer calls), plus a tiny off-React "am I in the glow"
// readout in the same shape as shelter.js — Campfire.jsx writes it once a
// frame, Survival.jsx (warmth) and Yeti.jsx (detection) both read it.

import { ARENA_HALF } from './arena.js'
import { generateTrees } from './trees.js'
import { generateSheds } from './sheds.js'
import { generatePonds } from './pond.js'

export const CAMPFIRE_COUNT = 3
// How close counts as "in the glow" — small enough that reaching it means
// committing to stand there, not just passing near it.
export const CAMPFIRE_RADIUS = 4.5
// Net warmth gained per second while in the glow. Survival.jsx folds this
// straight into the drain-rate calc (a big enough number to out-pace the base
// drain and then some), so standing at a fire is a real refill.
export const CAMPFIRE_REGEN_PER_SECOND = 9
// Detection-radius multiplier applied while the player is in the glow — the
// fire lights you up for anything already looking your way.
export const CAMPFIRE_DETECT_MULT = 1.6

const CAMPFIRE_SEED = 0xca4f17e5
const EDGE_MARGIN = 12 // keep campfires well inside the arena wall
const SPAWN_CLEAR = 18 // and off the player's start at (0, 8)
const CAMPFIRE_GAP = 28 // minimum centre-to-centre spacing
const SHED_CLEAR = 10 // stay clear of a shed's door / approach point
const POND_CLEAR = 6 // stay clear of a pond's rim
const TREE_CLEAR = 4 // no trunk right in the fire pit

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// CAMPFIRE_COUNT fires, deterministic every call: inside the arena, off the
// spawn, spaced apart, and clear of the sheds / ponds / tree trunks so none
// spawn half-buried or wedged against another set piece. Each is { x, z }.
export function generateCampfires() {
  const rand = mulberry32(CAMPFIRE_SEED)
  const trees = generateTrees()
  const sheds = generateSheds()
  const ponds = generatePonds()
  const limit = ARENA_HALF - EDGE_MARGIN
  const placed = []
  let guard = 0
  while (placed.length < CAMPFIRE_COUNT && guard++ < 6000) {
    const x = (rand() * 2 - 1) * limit
    const z = (rand() * 2 - 1) * limit
    if (Math.hypot(x - 0, z - 8) < SPAWN_CLEAR) continue
    if (placed.some((c) => Math.hypot(c.x - x, c.z - z) < CAMPFIRE_GAP)) continue
    if (sheds.some((s) => Math.hypot(s.x - x, s.z - z) < SHED_CLEAR)) continue
    if (ponds.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + POND_CLEAR)) continue
    if (trees.some((t) => Math.hypot(t.position[0] - x, t.position[2] - z) < TREE_CLEAR))
      continue
    placed.push({ x, z })
  }
  return placed
}

// True while (wx, wz) is within `radius` of any campfire.
export function nearCampfire(campfires, wx, wz, radius = CAMPFIRE_RADIUS) {
  for (let i = 0; i < campfires.length; i++) {
    const dx = wx - campfires[i].x
    const dz = wz - campfires[i].z
    if (dx * dx + dz * dz < radius * radius) return true
  }
  return false
}

// Per-frame "standing in the glow" readout — same off-React singleton shape as
// shelter.js / threat.js, kept out of the zustand store so a 60Hz write
// doesn't thrash every subscriber. Campfire.jsx writes it; Survival.jsx polls
// it for the warmth swing, Yeti.jsx for the detection balloon, Hud.jsx for the
// cue.
export const campfireGlow = { near: false }

export function resetCampfireGlow() {
  campfireGlow.near = false
}
