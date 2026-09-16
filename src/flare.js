// Step 7.9: the flare — a thrown area-denial throwable, the inverse of the
// 7.8 duck. Same off-React singleton shape as decoy.js / duck.js / poop.js,
// but Yeti.jsx never diverts to investigate it. Instead, for as long as it's
// burning, it's a circular obstacle in the same kinematic push-out pass as a
// tree trunk or a shed wall (see resolveTreeCollision in trees.js) — the yeti
// physically can't step inside its radius, so a chase or a search grinds along
// the edge instead of crossing it. The player isn't blocked at all: standing
// inside your own flare is the point.
//
// Throwables.jsx writes it on the throw (fresh landing point, bumped
// `throwId`) and clears `live` itself once the ground timer — the burn
// duration — runs out. Nothing else ever flips it back off, unlike the duck /
// poop / decoy, whose `live` is cleared by the yeti finishing an investigation.
export const FLARE_RADIUS = 9

// Seconds it keeps burning (and blocking) once it lands. Longer than the
// duck's or poop's ground timer on purpose — "for a while", per the README,
// not a snap divert.
export const FLARE_BURN_SECONDS = 16

export const flare = {
  throwId: 0, // bumped per throw; Throwables.jsx is the only reader/writer
  x: 0,
  z: 0,
  live: false, // burning and actively blocking the yeti
}

// Wipe it on a fresh scene (mount / restart) so a previous run's last throw
// can't linger into the next one.
export function resetFlare() {
  flare.throwId = 0
  flare.x = 0
  flare.z = 0
  flare.live = false
}

// Push a body of radius `bodyR` centred at (x, z) out of the flare circle
// while it's burning — same shape as resolveTreeCollision, just for the one
// dynamic circle instead of a fixed list. A no-op (straight passthrough) once
// it's spent. Writes into `out` ({ x, z }) and returns it; allocates nothing.
export function resolveFlareCollision(x, z, bodyR, out) {
  out.x = x
  out.z = z
  if (!flare.live) return out
  const dx = out.x - flare.x
  const dz = out.z - flare.z
  const min = FLARE_RADIUS + bodyR
  const d2 = dx * dx + dz * dz
  if (d2 >= min * min || d2 === 0) return out
  const d = Math.sqrt(d2)
  const push = (min - d) / d
  out.x += dx * push
  out.z += dz * push
  return out
}
