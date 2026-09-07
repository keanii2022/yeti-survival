// Step 6.9 — tree collision.
//
// The tree scatter and the collision push-out share this one module so there's
// a single source of truth for where the trunks are. World.jsx renders from
// `generateTrees()`; Player.jsx and Yeti.jsx call `resolveTreeCollision()` each
// frame against the same list.
//
// This is the README's "kinematic fallback": full @react-three/rapier physics
// would mean rebuilding the camera-as-player and the group-as-yeti around rigid
// bodies — far too invasive for what 6.9 needs. Instead both movers do their own
// position step as before, then get shoved back out of any trunk circle they
// overlap. The yeti stays dumb: it walks straight at you and simply can't pass
// through a trunk, which is exactly the cover the hide-and-seek steps want.

// Fixed seed so the layout is identical on every reload — colliders included.
const TREE_SEED = 20260905
export const TREE_COUNT = 220
export const TREE_SPREAD = 52
const SPAWN_CLEAR = 7 // keep the player's spawn area unplanted

// Small deterministic PRNG (mulberry32) — same generator World.jsx used inline.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The scatter: `count` pines across a 2*spread square, none in the spawn circle.
// The rand() call order (x, z, rotation, scale) is kept exactly as it was when
// this lived in World.jsx so the stand doesn't shift under existing playtests.
// `collideR` is a touch wider than the visible trunk cylinder (r 0.16–0.22 at
// this scale) so you bump bark instead of clipping it, but nowhere near the
// foliage cone — trees are cover, not walls.
export function generateTrees(count = TREE_COUNT, spread = TREE_SPREAD) {
  const rand = mulberry32(TREE_SEED)
  const placed = []
  while (placed.length < count) {
    const x = (rand() * 2 - 1) * spread
    const z = (rand() * 2 - 1) * spread
    if (Math.hypot(x, z) < SPAWN_CLEAR) continue
    const rotation = [0, rand() * Math.PI * 2, 0]
    const scale = 0.8 + rand() * 0.9
    placed.push({ position: [x, 0, z], rotation, scale, collideR: 0.45 * scale })
  }
  return placed
}

// Push a body of radius `bodyR` centred at (x, z) out of every trunk it
// overlaps, resolving against all trees in one pass so a body wedged between two
// of them settles instead of tunnelling through. Writes the corrected position
// into `out` ({ x, z }) and returns it; allocates nothing.
export function resolveTreeCollision(trees, x, z, bodyR, out) {
  out.x = x
  out.z = z
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i]
    const dx = out.x - t.position[0]
    const dz = out.z - t.position[2]
    const min = t.collideR + bodyR
    const d2 = dx * dx + dz * dz
    if (d2 >= min * min || d2 === 0) continue
    const d = Math.sqrt(d2)
    const push = (min - d) / d
    out.x += dx * push
    out.z += dz * push
  }
  return out
}
