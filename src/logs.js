// Step 7.12 — jump, and the first obstacle it exists for: fallen logs.
//
// A log is a capsule lying on the ground: a line segment from -halfLength to
// +halfLength along its own local +Z axis, padded out by collideR. That's the
// same "heading" convention the yeti's movement and the shed doorway use —
// world direction (sin(yaw), cos(yaw)) is local +Z at yaw 0 — so the rotation
// math below is copy-pasted straight from resolveShedCollision's world<->local
// transform, just against a segment instead of a set of wall rectangles.
//
// Same shared-module shape as trees.js and sheds.js: World.jsx renders
// straight off generateLogs(), Player.jsx and Yeti.jsx collide against the
// same list. The player has a hop (Player.jsx's jump timer skips
// resolveLogCollision while airborne), so a log reads as a low obstacle you
// can clear without breaking stride. The yeti has no jump — it just walks
// into a log's collider and grinds along it like it does a tree trunk, which
// in practice means routing around one end. Its push-out radius is the same
// (wider) YETI_RADIUS already used against trees, so a log stops it exactly
// as solidly and it "detours around" purely as a side effect of being dumb
// against a long obstacle.

const LOG_SEED = 0x6c0910a1
export const LOG_COUNT = 14
export const LOG_RADIUS = 0.42
// A touch wider than the visible log so you bump wood, not clip it — same
// margin idea as a tree's collideR over its visible trunk.
const LOG_COLLIDE_R = LOG_RADIUS + 0.15
const LOG_HALF_MIN = 2.2
const LOG_HALF_MAX = 4
const SPREAD = 52 // matches the tree scatter's spread
const SPAWN_CLEAR = 10 // keep the player's spawn area unobstructed

// Small deterministic PRNG (mulberry32) — same generator trees.js/sheds.js use.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// `count` fallen logs, fixed seed so the layout is identical on every reload.
// Each is { x, z, yaw, halfLength, radius, collideR } — yaw is the direction
// its length runs, same convention as the yeti's heading (world direction
// (sin(yaw), cos(yaw)) at yaw 0).
export function generateLogs(count = LOG_COUNT) {
  const rand = mulberry32(LOG_SEED)
  const placed = []
  while (placed.length < count) {
    const x = (rand() * 2 - 1) * SPREAD
    const z = (rand() * 2 - 1) * SPREAD
    if (Math.hypot(x, z) < SPAWN_CLEAR) continue
    const yaw = rand() * Math.PI * 2
    const halfLength = LOG_HALF_MIN + rand() * (LOG_HALF_MAX - LOG_HALF_MIN)
    placed.push({ x, z, yaw, halfLength, radius: LOG_RADIUS, collideR: LOG_COLLIDE_R })
  }
  return placed
}

// Push a body of radius `bodyR` centred at (x, z) out of every log it
// overlaps, resolving against all logs in one pass so a body wedged between
// two of them settles instead of tunnelling through. Writes the corrected
// position into `out` ({ x, z }) and returns it; allocates nothing.
export function resolveLogCollision(logs, x, z, bodyR, out) {
  out.x = x
  out.z = z
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]
    const dx = out.x - log.x
    const dz = out.z - log.z
    const c = Math.cos(log.yaw)
    const s = Math.sin(log.yaw)
    // World -> log-local: local Z runs along the log's length.
    const lx = dx * c - dz * s
    const lz = dx * s + dz * c
    const nearZ = Math.max(-log.halfLength, Math.min(log.halfLength, lz))
    const ox = lx
    const oz = lz - nearZ
    const min = log.collideR + bodyR
    const d2 = ox * ox + oz * oz
    if (d2 >= min * min || d2 === 0) continue
    const d = Math.sqrt(d2)
    const push = (min - d) / d
    const nlx = ox * push
    const nlz = oz * push
    // Log-local -> world (the inverse rotation).
    out.x += nlx * c + nlz * s
    out.z += -nlx * s + nlz * c
  }
  return out
}
