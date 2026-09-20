// Step 8.2: roar / stun — a telegraphed AOE the yeti unleashes mid-chase.
//
// He plants and roars for a windup (Yeti.jsx owns the timing); when it lands
// — the player still in his sightline, meaning not hidden and with no tree
// canopy between them — it's a brief slow plus a screen shake. Ducking behind
// a trunk or into a shed during the windup dodges it outright, which is the
// whole point: it punishes standing still in the open, not being chased per
// se.
//
// Same off-React singleton pattern as threat.js / greenEmber.js / decoy.js:
// Yeti.jsx writes `telegraph` (0→1 through the windup, back to 0 once it
// resolves) so Sound.jsx / Hud.jsx can layer a rising warning cue, and sets
// `stunTimer` / `shakeTimer` when it lands. Player.jsx ticks both timers down
// and reads them for the movement slow and the camera jitter.
export const roar = { telegraph: 0, stunTimer: 0, shakeTimer: 0 }

export const ROAR_SLOW_MULT = 0.55 // movement speed multiplier while stunTimer is running
export const ROAR_STUN_SECONDS = 2.5
export const ROAR_SHAKE_SECONDS = 0.6

// Canopy radius (before a tree's own `scale`) that blocks the roar — wider
// than trees.js's collideR (the physical trunk you bump), matching the
// visible foliage cone (World.jsx's body cone is radius 1.1 * scale) so
// "duck behind a tree" reads the way it looks.
const OCCLUDE_R = 0.9

// True if the straight line from (x1, z1) to (x2, z2) passes through any
// tree's canopy — a segment-vs-circle intersection test, radius scaled per
// tree. `trees` is a trees.js generateTrees() list.
export function sightlineBlocked(trees, x1, z1, x2, z2) {
  const dx = x2 - x1
  const dz = z2 - z1
  const a = dx * dx + dz * dz
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i]
    const r = OCCLUDE_R * t.scale
    const fx = x1 - t.position[0]
    const fz = z1 - t.position[2]
    if (a < 1e-9) {
      if (fx * fx + fz * fz <= r * r) return true
      continue
    }
    const b = 2 * (fx * dx + fz * dz)
    const c = fx * fx + fz * fz - r * r
    const disc = b * b - 4 * a * c
    if (disc < 0) continue
    const sqrtDisc = Math.sqrt(disc)
    const t1 = (-b - sqrtDisc) / (2 * a)
    const t2 = (-b + sqrtDisc) / (2 * a)
    if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) return true
  }
  return false
}

// Wipe it on a fresh scene (mount / restart) so a previous run's roar can't
// leave the player stunned or the screen mid-shake into the next one.
export function resetRoar() {
  roar.telegraph = 0
  roar.stunTimer = 0
  roar.shakeTimer = 0
}
