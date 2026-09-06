import { create } from 'zustand'

// Game state for step 4: a live run tracks warmth, score and how many embers
// you've grabbed. A run ends one of two ways — the yeti catches you, or your
// warmth hits zero — and the game-over screen reads `status` to say which.
//
// Step 6.5 reworks what the run is worth. The game-over screen leads with the
// level reached, then the time survived, then a flat bonus per ember. Score is
// now purely those ember bonuses (green-ember bonuses join in 6.7); level and
// time survived are their own lines, groundwork for the 6.6 level climb.

const START_WARMTH = 100
const START_STAMINA = 100

// Flat points per ember — the whole of `score` for now. Kept here so the HUD
// can show the "N embers x EMBER_SCORE" breakdown without reaching into Items.
export const EMBER_SCORE = 100

// Embers still buy back warmth, but well under the old 16 — a full six-ember
// clear tops up ~12s against the 5/s drain, not a near-refill. Warmth stays a
// real death clock (the blanket in 6.13 is the actual warmth lever). 6.6
// retunes this against its wave counts.
export const WARMTH_PER_EMBER = 10

// Once stamina bottoms out, sprint stays locked until it regenerates back past
// this threshold — so an empty bar is a real recovery window, not a one-frame dip.
const SPRINT_UNLOCK = 30

// How many embers are scattered in the arena. Items.jsx reads this so there's
// one source of truth for the count.
export const ITEM_TOTAL = 6

export const useGame = create((set) => ({
  // 'playing' while the run is live, 'paused' when the player hits Space, then
  // 'caught' or 'frozen' once it's over. Every ticking system (warmth, the yeti,
  // movement, scoring) gates on status === 'playing', so 'paused' freezes the
  // whole simulation for free.
  status: 'playing',

  // Bumped on every reset. App uses it as a React key on the <Canvas> so a new
  // run rebuilds the scene from scratch — camera back to spawn, yeti back to its
  // post, embers all restored — without any manual teardown.
  runId: 0,

  score: 0,
  itemsCollected: 0,
  itemsTotal: ITEM_TOTAL,

  // The level reached this run. Fixed at 1 until 6.6 turns the run into a climb
  // through ~10 levels; wired through the store and the game-over screen now so
  // that step only has to advance it.
  level: 1,

  // Seconds survived — real playing time, ticked by Survival.jsx on the same
  // gate as warmth drain (live run, pointer locked), so the start prompt and
  // the game-over screen don't pad it.
  elapsed: 0,

  // 0–100. Bleeds away while you're out in the cold; embers top it back up.
  warmth: START_WARMTH,

  // 0–100. Sprinting burns it; walking or standing still refills it. Hit 0 and
  // `sprintLocked` pins you to walk speed until it climbs back past SPRINT_UNLOCK.
  stamina: START_STAMINA,
  sprintLocked: false,

  collectItem: (value, warmthBonus = 0) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      return {
        score: s.score + value,
        itemsCollected: s.itemsCollected + 1,
        warmth: Math.min(START_WARMTH, s.warmth + warmthBonus),
      }
    }),

  // Called every frame while you're in control. Adds real seconds onto the run
  // clock the game-over screen reads back.
  tickTime: (delta) =>
    set((s) => (s.status === 'playing' ? { elapsed: s.elapsed + delta } : {})),

  // Called every frame while you're in control. Drains warmth by `amount` and
  // ends the run the moment it runs out.
  tickWarmth: (amount) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      const warmth = s.warmth - amount
      if (warmth <= 0) return { warmth: 0, status: 'frozen' }
      return { warmth }
    }),

  // Called every frame by the player controller. `draining` is true only when
  // the player is actually sprinting this frame; otherwise the bar regenerates.
  tickStamina: (draining, amount) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      const stamina = Math.max(
        0,
        Math.min(START_STAMINA, s.stamina + (draining ? -amount : amount)),
      )
      let sprintLocked = s.sprintLocked
      if (stamina <= 0) sprintLocked = true
      else if (stamina >= SPRINT_UNLOCK) sprintLocked = false
      if (stamina === s.stamina && sprintLocked === s.sprintLocked) return {}
      return { stamina, sprintLocked }
    }),

  pause: () => set((s) => (s.status === 'playing' ? { status: 'paused' } : {})),
  resume: () => set((s) => (s.status === 'paused' ? { status: 'playing' } : {})),

  catchPlayer: () =>
    set((s) => (s.status === 'playing' ? { status: 'caught' } : {})),

  reset: () =>
    set((s) => ({
      status: 'playing',
      runId: s.runId + 1,
      score: 0,
      itemsCollected: 0,
      level: 1,
      elapsed: 0,
      warmth: START_WARMTH,
      stamina: START_STAMINA,
      sprintLocked: false,
    })),
}))
