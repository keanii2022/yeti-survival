// Per-frame threat readout: the Yeti writes it, the audio engine and the
// proximity vignette read it. Deliberately kept out of the zustand store —
// updating a value 60 times a second there would thrash every subscriber.
//
// mode is 'idle' | 'chase' | 'search' (6.11) — 'search' is the yeti hunting
// your last-known spot after losing sight: tension holds, strings ease off.
export const threat = { distance: Infinity, mode: 'idle' }
