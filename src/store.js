import { create } from 'zustand'

// Game state for step 4: a live run tracks warmth, score and how many embers
// you've grabbed. A run ends one of two ways — the yeti catches you, or your
// warmth hits zero — and the game-over screen reads `status` to say which.

const START_WARMTH = 100

// How many embers are scattered in the arena. Items.jsx reads this so there's
// one source of truth for the count.
export const ITEM_TOTAL = 6

export const useGame = create((set) => ({
  // 'playing' while the run is live, then 'caught' or 'frozen' once it's over.
  status: 'playing',

  // Bumped on every reset. App uses it as a React key on the <Canvas> so a new
  // run rebuilds the scene from scratch — camera back to spawn, yeti back to its
  // post, embers all restored — without any manual teardown.
  runId: 0,

  score: 0,
  itemsCollected: 0,
  itemsTotal: ITEM_TOTAL,

  // 0–100. Bleeds away while you're out in the cold; embers top it back up.
  warmth: START_WARMTH,

  collectItem: (value, warmthBonus = 0) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      return {
        score: s.score + value,
        itemsCollected: s.itemsCollected + 1,
        warmth: Math.min(START_WARMTH, s.warmth + warmthBonus),
      }
    }),

  // Called every frame while you're in control. Drains warmth by `amount` and
  // ends the run the moment it runs out.
  tickWarmth: (amount) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      const warmth = s.warmth - amount
      if (warmth <= 0) return { warmth: 0, status: 'frozen' }
      return { warmth }
    }),

  catchPlayer: () =>
    set((s) => (s.status === 'playing' ? { status: 'caught' } : {})),

  reset: () =>
    set((s) => ({
      status: 'playing',
      runId: s.runId + 1,
      score: 0,
      itemsCollected: 0,
      warmth: START_WARMTH,
    })),
}))
