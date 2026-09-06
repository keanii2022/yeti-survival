import { create } from 'zustand'

// Minimal game state for step 3: are we still playing, or did the yeti get us?
// Scoring, warmth and a proper game-over screen arrive in step 4 — this store is
// deliberately tiny so it can grow into that without a rewrite.
export const useGame = create((set) => ({
  // 'playing' while the run is live, 'caught' once the yeti reaches the player.
  status: 'playing',

  // Bumped on every reset. App uses it as a React key on the <Canvas> so a new
  // run rebuilds the scene from scratch — camera back to spawn, yeti back to its
  // post, keys cleared — without any manual teardown.
  runId: 0,

  catchPlayer: () =>
    set((s) => (s.status === 'playing' ? { status: 'caught' } : {})),

  reset: () => set((s) => ({ status: 'playing', runId: s.runId + 1 })),
}))
