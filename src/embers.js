// Step 8.1: per-frame readout of the current level's ember wave, published by
// Items.jsx so the yeti's distracted-feeding behaviour (feeding.js, driven
// from Yeti.jsx) knows where the embers of a level actually are — without a
// store subscription thrashing every subscriber 60 times a second, same
// reasoning as threat.js.
//
// `level` lets a reader confirm the reading is for the wave currently in
// play (not a stale frame from the level just cleared, or the one about to
// spawn). 8.7: `nearX/Z` is the uncollected ember nearest the yeti (off
// threat.yetiX/Z, a frame stale at most) — where he heads when he breaks off
// to feed. Only meaningful while `remaining` > 0.
export const emberField = { level: 0, remaining: 0, nearX: 0, nearZ: 0 }
