// Step 6.7: per-frame readout for the green ember, same off-React pattern as
// threat.js. GreenEmber.jsx writes it every frame; Player.jsx reads `boost` to
// decide whether a sprint runs at the adrenaline speed (~11) instead of 10.
//
// `boost` is true while the player is inside the green ember's radius, and stays
// true for the short escape window after grabbing it — long enough to actually
// out-run the yeti's close-range lunge with it in hand.
export const greenEmber = { boost: false }
