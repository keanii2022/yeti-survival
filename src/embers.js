// Step 8.1: per-frame readout of the current level's ember wave, published by
// Items.jsx so the yeti's distracted-feeding behaviour (feeding.js, driven
// from Yeti.jsx) knows where the last few embers of a level actually are —
// without a store subscription thrashing every subscriber 60 times a second,
// same reasoning as threat.js.
//
// `level` lets a reader confirm the reading is for the wave currently in
// play (not a stale frame from the level just cleared, or the one about to
// spawn). `clusterX/Z` is only meaningful once `remaining` is small enough
// to count as the final cluster — it's still updated every frame regardless,
// which is cheap, so there's nothing to gate on write.
export const emberField = { level: 0, remaining: 0, clusterX: 0, clusterZ: 0 }
