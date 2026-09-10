// Off-React mirror of World.jsx's time-of-day dial, written every frame by
// <DayCycle>. Same singleton pattern as threat.js / greenEmber.js — it lets
// systems outside the lighting rig read how dark it's got without threading a
// prop down through the scene.
//
// `u` is the raw dial (0 = afternoon, ~1 = deep night); `night` is 0 through
// dusk and ramps to 1 across the blue hour (World.nightAmount). Step 7.7's
// consumable picker only swaps the snack for the water bottle once `night`
// crosses NIGHT_CUTOFF *and* the run is a Nightfall run — see Consumables.jsx.
export const daylight = { u: 0, night: 0 }

// "Properly dark" — well past dusk and the first stars, deep into the blue hour.
// A Nightfall run opens above this (rollDayStart(true) ≥ 0.8 → night ≈ 0.85), so
// the bottle is available from that run's first spawn; a normal run never gets
// close.
export const NIGHT_CUTOFF = 0.8

export const isNight = () => daylight.night >= NIGHT_CUTOFF

// Wipe on a scene remount (per run) so the next run's first frame doesn't read
// the last run's dial before <DayCycle> re-seeds it.
export function resetDaylight() {
  daylight.u = 0
  daylight.night = 0
}
