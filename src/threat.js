// Per-frame threat readout: the Yeti writes it, the audio engine and the
// proximity vignette read it. Deliberately kept out of the zustand store —
// updating a value 60 times a second there would thrash every subscriber.
export const threat = { distance: Infinity, mode: 'idle' }
