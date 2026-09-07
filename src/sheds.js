// Step 6.12 — enterable sheds.
//
// A handful of little huts scattered across the arena. Duck through the doorway
// and the yeti loses you (he can't see through walls) and the cold bites a bit
// slower — but warmth is still ticking and you're not out collecting embers, so
// hiding is a trade, not a safe room. The yeti periodically breaks off his
// wander to walk over and check the nearest one, with a tell (Sound.jsx) so
// bolting is a fair panic moment.
//
// Same shape as trees.js: one fixed-seed generator that every consumer calls
// (World renders it, Player / Yeti collide against it, Sheds.jsx runs the
// "am I inside" check), plus a pure kinematic push-out. No physics, no
// pathfinding — the yeti just can't clip through the planks.

import { ARENA_HALF } from './arena.js'
import { generateTrees } from './trees.js'

// --- shed dimensions (metres, in shed-local space) ------------------------
// The footprint is a square whose wall centre-lines sit at +/-SHED_HALF on each
// axis; walls are 2*WALL_THICK thick. The doorway is a DOOR_WIDTH gap in the
// front face, which points along the shed's +local-Z (its `yaw`).
export const SHED_HALF = 2.5
export const WALL_THICK = 0.3
export const WALL_HEIGHT = 2.6
export const DOOR_WIDTH = 1.7
export const ROOF_RISE = 1.6

// How far off the door the yeti plants himself to look it over — clear of the
// wall collider (needs > SHED_HALF + WALL_THICK + yeti radius) with room to spare.
export const SHED_APPROACH = SHED_HALF + WALL_THICK + 2.5

const H = SHED_HALF
const T = WALL_THICK
const HD = DOOR_WIDTH / 2

// The five wall rectangles in shed-local space (axis-aligned here; the collider
// rotates the query point by -yaw before testing). Front face is split either
// side of the doorway gap. World.jsx renders boxes straight off this list so the
// planks you see are exactly the planks you bump.
export const SHED_WALLS = [
  { minX: -H - T, maxX: H + T, minZ: -H - T, maxZ: -H + T }, // back
  { minX: -H - T, maxX: -H + T, minZ: -H - T, maxZ: H + T }, // left
  { minX: H - T, maxX: H + T, minZ: -H - T, maxZ: H + T }, // right
  { minX: -H - T, maxX: -HD, minZ: H - T, maxZ: H + T }, // front, door-left
  { minX: HD, maxX: H + T, minZ: H - T, maxZ: H + T }, // front, door-right
]

// --- placement -----------------------------------------------------------
const SHED_SEED = 0x5ed70a12
export const SHED_COUNT = 4
const EDGE_MARGIN = 12 // keep sheds well inside the arena wall
const SPAWN_CLEAR = 16 // and off the player's start at (0, 8)
const SHED_GAP = 20 // minimum centre-to-centre spacing
const TREE_CLEAR = 5 // no tree trunk this close to a shed centre

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// SHED_COUNT huts, deterministic every call: inside the arena, off the spawn,
// spaced apart, and clear of the tree scatter so none spawn half-buried in a
// pine. Each is { x, z, yaw } — yaw is the direction the doorway faces.
export function generateSheds() {
  const rand = mulberry32(SHED_SEED)
  const trees = generateTrees()
  const limit = ARENA_HALF - EDGE_MARGIN
  const placed = []
  let guard = 0
  while (placed.length < SHED_COUNT && guard++ < 6000) {
    const x = (rand() * 2 - 1) * limit
    const z = (rand() * 2 - 1) * limit
    const yaw = rand() * Math.PI * 2
    if (Math.hypot(x - 0, z - 8) < SPAWN_CLEAR) continue
    if (placed.some((s) => Math.hypot(s.x - x, s.z - z) < SHED_GAP)) continue
    if (trees.some((t) => Math.hypot(t.position[0] - x, t.position[2] - z) < TREE_CLEAR))
      continue
    placed.push({ x, z, yaw })
  }
  return placed
}

// World point the yeti walks to when he checks `shed` — just outside the door.
export function shedApproachPoint(shed, out) {
  out.x = shed.x + Math.sin(shed.yaw) * SHED_APPROACH
  out.z = shed.z + Math.cos(shed.yaw) * SHED_APPROACH
  return out
}

// Nearest shed to (x, z) whose cooldown has run out, or -1 if none is ready.
export function nearestReadyShed(sheds, x, z, cooldowns) {
  let best = -1
  let bestD2 = Infinity
  for (let i = 0; i < sheds.length; i++) {
    if (cooldowns[i] > 0) continue
    const dx = sheds[i].x - x
    const dz = sheds[i].z - z
    const d2 = dx * dx + dz * dz
    if (d2 < bestD2) {
      bestD2 = d2
      best = i
    }
  }
  return best
}

// True while (wx, wz) is within the interior box of `shed` (past the inner wall
// face on both local axes) — i.e. the player has actually stepped inside, not
// just walked up to the doorway.
export function pointInsideShed(shed, wx, wz) {
  const dx = wx - shed.x
  const dz = wz - shed.z
  const c = Math.cos(shed.yaw)
  const s = Math.sin(shed.yaw)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  const lim = SHED_HALF - WALL_THICK - 0.05
  return Math.abs(lx) < lim && Math.abs(lz) < lim
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

// Push a body of radius `bodyR` centred at (x, z) out of every shed wall it
// overlaps, resolving all walls of a shed in one local-space pass so a body
// wedged in a corner settles instead of tunnelling. Writes the corrected
// position into `out` ({ x, z }) and returns it; allocates nothing. The doorway
// gap is just the absence of a wall rect, so a body small enough walks straight
// through it.
export function resolveShedCollision(sheds, x, z, bodyR, out) {
  out.x = x
  out.z = z
  for (let i = 0; i < sheds.length; i++) {
    const shed = sheds[i]
    const ddx = out.x - shed.x
    const ddz = out.z - shed.z
    // Cheap bounding-circle reject before the per-wall work.
    const reach = SHED_HALF + WALL_THICK + bodyR + 0.5
    if (ddx * ddx + ddz * ddz > 2 * reach * reach) continue

    const c = Math.cos(shed.yaw)
    const s = Math.sin(shed.yaw)
    let lx = ddx * c - ddz * s
    let lz = ddx * s + ddz * c
    const lx0 = lx
    const lz0 = lz
    let frontHit = false

    for (let w = 0; w < SHED_WALLS.length; w++) {
      const R = SHED_WALLS[w]
      const cx = clamp(lx, R.minX, R.maxX)
      const cz = clamp(lz, R.minZ, R.maxZ)
      const dx = lx - cx
      const dz = lz - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= bodyR * bodyR) continue
      if (w >= 3) frontHit = true
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2)
        const push = (bodyR - d) / d
        lx += dx * push
        lz += dz * push
      } else {
        // Centre buried in the rect — shove out along the shallowest face.
        const pl = lx - R.minX
        const pr = R.maxX - lx
        const pb = lz - R.minZ
        const pf = R.maxZ - lz
        const m = Math.min(pl, pr, pb, pf)
        if (m === pl) lx = R.minX - bodyR
        else if (m === pr) lx = R.maxX + bodyR
        else if (m === pb) lz = R.minZ - bodyR
        else lz = R.maxZ + bodyR
      }
    }

    // A body wider than the doorway gap (i.e. the yeti — the player is well
    // under it) can't actually be in the opening: the two jambs push it
    // sideways in equal measure and it ends up wedged dead-centre. When it's
    // hit the front face and it's too fat for the gap, eject it straight back
    // out along the door normal so it stays outside like it should.
    if (frontHit && bodyR > HD && Math.abs(lx) < HD + bodyR) {
      lz = Math.max(lz, H + T + bodyR)
    }

    const dlx = lx - lx0
    const dlz = lz - lz0
    if (dlx !== 0 || dlz !== 0) {
      out.x += dlx * c + dlz * s
      out.z += -dlx * s + dlz * c
    }
  }
  return out
}
