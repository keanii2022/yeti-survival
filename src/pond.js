// Step 7.13 — the frozen pond.
//
// A shortcut across the arena: fast to walk over, but sprinting across it
// cracks the ice (Player.jsx does the crack check and the warmth/immobilise
// hit; this module only knows where the ice is). The yeti won't set foot on
// it at all — resolvePondCollision treats the whole sheet as a solid circular
// obstacle in the same kinematic push-out pass as a tree trunk or a shed wall
// (see resolveTreeCollision / resolveFlareCollision), so a chase or a search
// grinds around the rim instead of crossing it. Ice is hard ground for 7.3
// (surface.js): no footprints, same as a shed floor.
//
// Same fixed-seed shared-module shape as sheds.js: one generator every
// consumer calls (World renders it, surface.js and Yeti.jsx read the list,
// Player.jsx runs the crack check). Only kept clear of the sheds — like logs.js,
// it doesn't bother excluding individual trees; at 220 of them across the
// arena a clearance wide enough to matter for an 8m-radius disc would rarely
// find a free spot at all, and a tree trunk poking through the edge of a flat
// ice sheet is a shrug, not a broken shed wall.

import { ARENA_HALF } from './arena.js'
import { generateSheds } from './sheds.js'

const POND_SEED = 0x9038a3d1
// Two: enough that the shortcut is a real option somewhere on a run without
// turning the 120x120 arena into an ice rink.
export const POND_COUNT = 2
export const POND_RADIUS = 8
const EDGE_MARGIN = 14 // keep ponds well inside the arena wall
const SPAWN_CLEAR = 18 // and off the player's start at (0, 8)
const POND_GAP = 30 // minimum centre-to-centre spacing between ponds
const SHED_CLEAR = POND_RADIUS + 12 // keep the shed's approach point clear too

// Small deterministic PRNG (mulberry32) — same generator every fixed-seed
// scatter in the project uses.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// POND_COUNT ponds, deterministic every call: inside the arena, off the
// spawn, spaced apart, and clear of the sheds. Each is { x, z, radius }.
export function generatePonds() {
  const rand = mulberry32(POND_SEED)
  const sheds = generateSheds()
  const limit = ARENA_HALF - EDGE_MARGIN
  const placed = []
  let guard = 0
  while (placed.length < POND_COUNT && guard++ < 6000) {
    const x = (rand() * 2 - 1) * limit
    const z = (rand() * 2 - 1) * limit
    if (Math.hypot(x - 0, z - 8) < SPAWN_CLEAR) continue
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < POND_GAP)) continue
    if (sheds.some((s) => Math.hypot(s.x - x, s.z - z) < SHED_CLEAR)) continue
    placed.push({ x, z, radius: POND_RADIUS })
  }
  return placed
}

// True while (x, z) is over the ice.
export function pointInsidePond(pond, x, z) {
  const dx = x - pond.x
  const dz = z - pond.z
  return dx * dx + dz * dz < pond.radius * pond.radius
}

// Push a body of radius `bodyR` out of every pond it overlaps — same circular
// push-out as resolveFlareCollision, just for a fixed list instead of one live
// throwable. The yeti is the only body this is ever called against; the
// player walks straight onto the ice on purpose. Writes into `out` ({ x, z })
// and returns it; allocates nothing.
export function resolvePondCollision(ponds, x, z, bodyR, out) {
  out.x = x
  out.z = z
  for (let i = 0; i < ponds.length; i++) {
    const pond = ponds[i]
    const dx = out.x - pond.x
    const dz = out.z - pond.z
    const min = pond.radius + bodyR
    const d2 = dx * dx + dz * dz
    if (d2 >= min * min || d2 === 0) continue
    const d = Math.sqrt(d2)
    const push = (min - d) / d
    out.x += dx * push
    out.z += dz * push
  }
  return out
}
