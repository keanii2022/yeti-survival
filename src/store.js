import { create } from 'zustand'
import { LEVEL_COUNT, levelTarget } from './levels.js'

// Game state. A live run tracks warmth, stamina, score, and — since 6.6 — a
// level. The run is a climb: clear each level's ember target, take a calm
// interlude, then the next level spawns harder. It ends one of three ways — the
// yeti catches you ('caught'), your warmth hits zero ('frozen'), or you clear
// all LEVEL_COUNT levels ('won'). Winning unlocks 'nightfall': the same climb
// again with every level pinned higher on the curve (see effectiveLevel), which
// runs to its own 'won' screen.
//
// 6.5 reworked what a run is worth: the game-over screen leads with the level
// reached, then time survived, then a flat bonus per ember. `score` is the sum
// of those ember bonuses; `embersTotal` is the run-long count behind it.

const START_WARMTH = 100
const START_STAMINA = 100

// Flat points per ember — the whole of `score` for now (green-ember bonuses
// join in 6.7). Kept here so the HUD can show the "N embers x EMBER_SCORE"
// breakdown without reaching into Items.
export const EMBER_SCORE = 100

// Embers still buy back warmth, but only a little. Eased from 10 in a playtest
// pass — with 7–8 embers a level the bank was running a touch fat; at 8 apiece
// a full clear roughly offsets the time it takes to grab them, no more. Warmth
// stays a real death clock; the blanket (6.13) is the actual warmth lever.
export const WARMTH_PER_EMBER = 8

// Once stamina bottoms out, sprint stays locked until it regenerates back past
// this threshold — so an empty bar is a real recovery window, not a one-frame dip.
const SPRINT_UNLOCK = 30

export const useGame = create((set) => ({
  // 'playing' while the run is live (this covers the between-levels interlude
  // too — see `interlude`), 'paused' on Space, then 'caught' / 'frozen' / 'won'
  // once it's over. Every ticking system gates on status === 'playing'.
  status: 'playing',

  // Bumped on every reset and on entering nightfall. App uses it as a React key
  // on the <Canvas> so a fresh scene rebuilds from scratch.
  runId: 0,

  score: 0,

  // 6.6: `itemsCollected` / `itemsTotal` are now per-LEVEL — embers grabbed in
  // the current level, and that level's target (6–8, see levelTarget). The
  // run-long count lives in `embersTotal`, which drives the score and the
  // game-over tally.
  itemsCollected: 0,
  itemsTotal: levelTarget(1),
  embersTotal: 0,

  // The level being played (1..LEVEL_COUNT, then unbounded in nightfall).
  level: 1,

  // True during the calm breather between clearing a level and the next wave.
  // Warmth drain pauses, the yeti is pushed to a far wander, the HUD shows the
  // "LEVEL N" card. Levels.jsx counts it down and calls endInterlude().
  interlude: false,

  // Set once LEVEL_COUNT is cleared and the player takes the harder replay.
  // Same 10 levels, same interludes; effectiveLevel() just shifts each one up
  // the curve.
  nightfall: false,

  // Seconds survived — real playing time, ticked by Survival.jsx on the same
  // gate as warmth drain. The interlude keeps counting; only warmth pauses.
  elapsed: 0,

  // 0–100. Bleeds away while you're out in the cold; embers top it back up.
  warmth: START_WARMTH,

  // 0–100. Sprinting burns it; walking or standing still refills it. Hit 0 and
  // `sprintLocked` pins you to walk speed until it climbs back past SPRINT_UNLOCK.
  stamina: START_STAMINA,
  sprintLocked: false,

  // Grab an ember: score + counts, a small warmth top-up, and — when it's the
  // one that clears the level — the transition. Clearing the final level wins
  // the run (the first win, or the end of nightfall); any earlier level opens
  // the interlude. Same in both modes.
  collectItem: (value, warmthBonus = 0) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      const itemsCollected = s.itemsCollected + 1
      const next = {
        score: s.score + value,
        itemsCollected,
        embersTotal: s.embersTotal + 1,
        warmth: Math.min(START_WARMTH, s.warmth + warmthBonus),
      }
      if (itemsCollected >= s.itemsTotal) {
        if (s.level >= LEVEL_COUNT) next.status = 'won'
        else next.interlude = true
      }
      return next
    }),

  // Called by Levels.jsx when the interlude timer runs out: advance to the next
  // level and spawn its wave.
  endInterlude: () =>
    set((s) => {
      if (!s.interlude) return {}
      const level = s.level + 1
      return {
        interlude: false,
        level,
        itemsTotal: levelTarget(level),
        itemsCollected: 0,
      }
    }),

  // From the win screen: take the harder replay. Back to level 1 with the
  // nightfall flag on, score and clock carried over, warmth and stamina fresh.
  // Remounts the scene (runId) so the yeti and the first wave re-roll.
  startNightfall: () =>
    set((s) => {
      if (s.status !== 'won') return {}
      return {
        status: 'playing',
        runId: s.runId + 1,
        nightfall: true,
        level: 1,
        itemsTotal: levelTarget(1),
        itemsCollected: 0,
        interlude: false,
        warmth: START_WARMTH,
        stamina: START_STAMINA,
        sprintLocked: false,
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
      itemsTotal: levelTarget(1),
      embersTotal: 0,
      level: 1,
      interlude: false,
      nightfall: false,
      elapsed: 0,
      warmth: START_WARMTH,
      stamina: START_STAMINA,
      sprintLocked: false,
    })),
}))
