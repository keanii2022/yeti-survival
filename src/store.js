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

// Flat points per ember. Kept here so the HUD can show the "N embers x
// EMBER_SCORE" breakdown without reaching into Items.
export const EMBER_SCORE = 100

// Step 6.7: the green ember. One at a time, spawns next to the yeti, so grabbing
// it means diving into danger — hence it's worth 5x a normal ember, and clearing
// the yeti's range with it in hand pays a further bonus. Neither counts toward a
// level's ember target; they're pure score on top of the climb.
export const GREEN_EMBER_SCORE = 500
export const GREEN_ESCAPE_BONUS = 250

// Embers still buy back warmth, but only a little. Eased from 10 in a playtest
// pass — with 7–8 embers a level the bank was running a touch fat; at 8 apiece
// a full clear roughly offsets the time it takes to grab them, no more. Warmth
// stays a real death clock; the blanket (6.13) is the actual warmth lever.
export const WARMTH_PER_EMBER = 8

// Once stamina bottoms out, sprint stays locked until it regenerates back past
// this threshold — so an empty bar is a real recovery window, not a one-frame dip.
const SPRINT_UNLOCK = 30

// Step 6.13: the two rare consumables (Consumables.jsx scatters them like embers,
// only far rarer). Both are carried, then triggered by hand — E for the snack,
// Q for the blanket (App.jsx). The snack pins stamina at full so you can sprint
// flat-out through the window; the blanket cuts the warmth drain hard (see
// BLANKET_DRAIN_FACTOR in Survival.jsx). Windows are short — one grab is a
// single get-out-of-trouble play, not a standing buff.
export const SNACK_SECONDS = 8
export const BLANKET_SECONDS = 12

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

  // 6.7 green-ember tallies — run-long counts the game-over ledger reads back.
  // `greenCount` is how many green embers were grabbed; `escapes` how many of
  // those turned into a clean getaway past the yeti.
  greenCount: 0,
  escapes: 0,

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

  // 6.13 consumables. `hasSnack` / `hasBlanket`: one of each is carried at most.
  // `snackActive` pins stamina at full (see tickStamina); `blanketActive` slows
  // the warmth drain (see Survival.jsx). Consumables.jsx counts the windows down
  // and calls endSnack / endBlanket.
  hasSnack: false,
  hasBlanket: false,
  snackActive: false,
  blanketActive: false,

  // 6.14 decoy. Carried one at a time like the consumables, but there's no
  // active window — throwing it (F) just drops it from the hand and Decoy.jsx
  // takes over: it picks the landing spot and pokes the yeti into a divert
  // (decoy.js / Yeti.jsx). Pure utility, no score, no warmth.
  hasDecoy: false,

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

  // Grab the green ember (6.7): a big flat score bump. Doesn't touch the level
  // count, the ember target, or warmth — it's a risk play for points, not a
  // warmth lever. GreenEmber.jsx then opens a short escape window.
  collectGreenEmber: () =>
    set((s) =>
      s.status !== 'playing'
        ? {}
        : { score: s.score + GREEN_EMBER_SCORE, greenCount: s.greenCount + 1 },
    ),

  // Cleared the yeti's range with the green ember in hand before the escape
  // window closed — pay the getaway bonus.
  greenEscape: () =>
    set((s) =>
      s.status !== 'playing'
        ? {}
        : { score: s.score + GREEN_ESCAPE_BONUS, escapes: s.escapes + 1 },
    ),

  // Walk over a snack or a blanket (Consumables.jsx): pocket it, unless you're
  // already carrying that kind — you can't stack two, so the second sits and
  // waits until the first is spent.
  grabConsumable: (kind) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      if (kind === 'snack' && !s.hasSnack) return { hasSnack: true }
      if (kind === 'blanket' && !s.hasBlanket) return { hasBlanket: true }
      if (kind === 'decoy' && !s.hasDecoy) return { hasDecoy: true }
      return {}
    }),

  // Eat the snack (E): stamina jumps to full and stays pinned there for the
  // window — sprint is free and unlockable the whole time. No-op without one.
  useSnack: () =>
    set((s) =>
      s.status !== 'playing' || !s.hasSnack
        ? {}
        : {
            hasSnack: false,
            snackActive: true,
            stamina: START_STAMINA,
            sprintLocked: false,
          },
    ),
  endSnack: () => set((s) => (s.snackActive ? { snackActive: false } : {})),

  // Wrap the blanket (Q): warmth drains much slower for the window. No-op
  // without one.
  useBlanket: () =>
    set((s) =>
      s.status !== 'playing' || !s.hasBlanket
        ? {}
        : { hasBlanket: false, blanketActive: true },
    ),
  endBlanket: () => set((s) => (s.blanketActive ? { blanketActive: false } : {})),

  // Throw a carried decoy (F): drop it from the hand. Decoy.jsx's throw handler
  // does the rest — picks the landing spot from where you're facing and pokes
  // the yeti into a divert. No-op without one.
  throwDecoy: () =>
    set((s) => (s.status !== 'playing' || !s.hasDecoy ? {} : { hasDecoy: false })),

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
        hasSnack: false,
        hasBlanket: false,
        snackActive: false,
        blanketActive: false,
        hasDecoy: false,
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
      // 6.13: while a snack is working, the bar is welded to full and sprint
      // never locks — the whole point of eating one.
      if (s.snackActive) {
        return s.stamina === START_STAMINA && !s.sprintLocked
          ? {}
          : { stamina: START_STAMINA, sprintLocked: false }
      }
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
      greenCount: 0,
      escapes: 0,
      level: 1,
      interlude: false,
      nightfall: false,
      elapsed: 0,
      warmth: START_WARMTH,
      stamina: START_STAMINA,
      sprintLocked: false,
      hasSnack: false,
      hasBlanket: false,
      snackActive: false,
      blanketActive: false,
      hasDecoy: false,
    })),
}))
