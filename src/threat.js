// Per-frame threat readout: the Yeti writes it, the audio engine and the
// proximity vignette read it. Deliberately kept out of the zustand store —
// updating a value 60 times a second there would thrash every subscriber.
//
// mode is 'idle' | 'chase' | 'search' (6.11) — 'search' is the yeti hunting
// your last-known spot after losing sight: tension holds, strings ease off.
//
// yetiX / yetiZ (6.7) are the yeti's world position, published so the green
// ember can spawn a short walk from wherever it currently is.
export const threat = { distance: Infinity, mode: 'idle', yetiX: 0, yetiZ: 0 }
