import { create } from 'zustand'
import { LEVEL_COUNT, levelTarget } from './levels.js'
import { nextFilledSlot } from './inventory.js'
import { loadDifficulty, saveDifficulty } from './difficulty.js'

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
// only far rarer). Since 7.4 they ride the generic inventory — carried in one of
// four slots, triggered by that slot's key (V/B/N/M, App.jsx). The snack pins
// stamina at full so you can sprint flat-out through the window.
//
// Step 7.6: the blanket stopped being a timed window. Q sets it down in the
// world (routed through the same drop handoff as a hold-E ditch, just flagged
// `placed`); `blanketActive` is now the live "standing on it" state Drops.jsx
// toggles by proximity, and it eases the warmth drain (BLANKET_DRAIN_FACTOR in
// Survival.jsx) for exactly as long as you stay on the spot.
//
// Step 7.7: the water bottle is a Nightfall-only upgrade of the snack — the
// picker in Consumables.jsx only swaps it in when the run is Nightfall *and* the
// day dial is properly dark (daylight.js). It welds stamina the same way (via
// `waterActive`, which tickStamina honours alongside `snackActive`), runs a
// longer window, and Player.jsx reads `waterActive` for a bigger flat speed bump
// (WATER_SPEED_BONUS) than the snack ever gave.
export const SNACK_SECONDS = 8
export const WATER_SECONDS = 12

// Step 7.4: four generic carry slots. A slot holds an item kind ('snack' |
// 'water' | 'blanket' | 'decoy') or null. A pickup lands in the first free slot;
// a number key spends that slot, R drops the first.
export const SLOT_COUNT = 4
const emptySlots = () => new Array(SLOT_COUNT).fill(null)

// Keep the carried items left-packed with no gaps, so slot 1 is always your
// first item, 2 your second, and so on — that's what the number keys and the HUD
// chips read as. Without this, using or dropping a low slot leaves a hole and
// "press 1" starts missing.
const compact = (slots) => {
  const kept = slots.filter((v) => v != null)
  while (kept.length < SLOT_COUNT) kept.push(null)
  return kept
}

// One-time second chance. On the FIRST death of a run the game-over card offers
// "keep going" instead of only a full restart: respawn at the arena start with
// warmth and stamina refilled and the yeti thrown wide, the run and score
// intact. Spend it (or die again after) and the next death is a plain restart.
// The grace window is a breath right after respawn where the cold can't kill
// you and the yeti can't catch you — mostly it just covers the desktop
// click-to-recapture-the-mouse beat.
export const REVIVE_GRACE_MS = 3000
const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

export const useGame = create((set) => ({
  // 'playing' while the run is live (this covers the between-levels interlude
  // too — see `interlude`), 'paused' on Space, then 'caught' / 'frozen' / 'won'
  // once it's over. Every ticking system gates on status === 'playing'.
  status: 'playing',

  // Bumped on every reset and on entering nightfall. App uses it as a React key
  // on the <Canvas> so a fresh scene rebuilds from scratch.
  runId: 0,

  // Step 9.1: coarse-pointer device. Set once — at startup from matchMedia, or
  // on the first touchstart — and never cleared: a device that's seen one touch
  // is a touch device for the session. The whole mobile layer (drag-look, the
  // 9.2 joystick, 9.3 buttons, the 9.5 perf tier) mounts off this. Not run
  // state, so reset() leaves it alone.
  isTouch: false,
  setTouch: () => set((s) => (s.isTouch ? {} : { isTouch: true })),

  // 'easy' | 'medium' | 'hard' (difficulty.js). Chosen from the start screen or
  // a game-over card, persisted to localStorage, and — like isTouch — a session
  // preference, not run state: reset() / startNightfall() leave it alone. 'hard'
  // is the original playtested curve; 'medium' (default) and 'easy' ease the
  // warmth drain (Survival.jsx) and the yeti's speed / senses (levels.js).
  difficulty: loadDifficulty(),
  setDifficulty: (difficulty) =>
    set((s) => {
      if (s.difficulty === difficulty) return {}
      saveDifficulty(difficulty)
      return { difficulty }
    }),

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

  // 7.4 inventory. `slots` is four entries, each an item kind or null, kept
  // left-packed (store `compact`). A pickup (Consumables.jsx / Decoy.jsx) calls
  // grabItem to take the first free one; useSlot / dropSlot spend or ditch one.
  // `snackActive` and `waterActive` (7.7) each pin stamina at full while their
  // window runs (tickStamina honours either); Consumables.jsx counts the two
  // windows down and calls endSnack / endWater. `blanketActive` (7.6) is
  // set/cleared by Drops.jsx from proximity to a set-down blanket, not a timer —
  // it eases the warmth drain in Survival.jsx while you stand on one.
  slots: emptySlots(),
  selectedSlot: 0,
  snackActive: false,
  waterActive: false,
  blanketActive: false,

  // 7.5: the drop handoff. dropSlot stamps `pendingDrop` with the item kind and
  // bumps `dropReq`; Drops.jsx subscribes to the edge and places a world marker
  // at the camera position (which only exists inside the Canvas). Same opaque
  // edge-counter shape as `throwReq` — reset() / startNightfall() clear it, and
  // Drops.jsx re-seeds its "seen" on mount. 7.6: `pendingDropPlaced` rides
  // alongside — true when the handoff is a blanket set down with Q (a marker you
  // stand on, never auto-re-pocketed), false for a plain hold-E ditch.
  dropReq: 0,
  pendingDrop: null,
  pendingDropPlaced: false,

  // Bumped every time a decoy leaves a slot (useSlot). Decoy.jsx subscribes to
  // it and does the actual throw — the arc needs the camera heading, which only
  // exists inside the Canvas. Not reset between runs: it's an opaque edge
  // counter and the consumers re-seed their "last seen" on mount.
  throwReq: 0,

  // One-time second chance (see REVIVE_GRACE_MS). `reviveUsed` flips true once
  // the run's revive is spent — reset() / startNightfall() clear it. `reviveReq`
  // is the opaque edge counter Player.jsx and Yeti.jsx watch to snap the camera
  // back to spawn and throw the yeti wide (same shape as throwReq — untouched
  // between runs, consumers re-seed on mount). `graceUntil` is a performance.now
  // stamp before which tickWarmth / catchPlayer no-op.
  reviveUsed: false,
  reviveReq: 0,
  graceUntil: 0,

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

  // Walk over a snack / water / blanket / decoy (Consumables.jsx, Decoy.jsx):
  // drop it into the first free slot. Inventory full → no-op, and the pickup
  // stays out in the world. Duplicates are allowed (two snacks is a fair use of
  // two slots); the pickups' own respawn cooldowns keep that from flooding.
  grabItem: (kind) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      const i = s.slots.indexOf(null)
      if (i === -1) return {}
      const slots = s.slots.slice()
      slots[i] = kind
      return { slots }
    }),

  // E: move the highlight to the next filled slot, wrapping. Unbound since the
  // controls pass (numbers hit slots directly, R drops the first) but kept for
  // the touch layer / tests. No-op with fewer than two items.
  cycleSlot: () =>
    set((s) => {
      if (s.status !== 'playing' || s.interlude) return {}
      const selectedSlot = nextFilledSlot(s.slots, s.selectedSlot)
      return selectedSlot === s.selectedSlot ? {} : { selectedSlot }
    }),

  // Spend the item in slot `i` (App.jsx: a number key, or Q for slot 0; the
  // touch buttons pass their own index). Snack → `snackActive`, stamina welds to
  // full for SNACK_SECONDS; water bottle (7.7) → `waterActive`, the same weld
  // for the longer WATER_SECONDS plus the bigger Player speed bump; blanket →
  // set down in the world (7.6): same drop handoff as a plain ditch but flagged
  // `placed`, so Drops.jsx drops a marker you can stand on for the eased drain
  // and walk back to via the pip; decoy → the slot clears and throwReq bumps for
  // Decoy.jsx to fling. The remaining items pack left (compact) and the
  // highlight resets to the first. No-op on an empty slot, a finished run, or
  // the interlude.
  useSlot: (i) =>
    set((s) => {
      if (s.status !== 'playing' || s.interlude) return {}
      const kind = s.slots[i]
      if (!kind) return {}
      const slots = s.slots.slice()
      slots[i] = null
      const base = { slots: compact(slots), selectedSlot: 0 }
      if (kind === 'snack')
        return {
          ...base,
          snackActive: true,
          stamina: START_STAMINA,
          sprintLocked: false,
        }
      if (kind === 'water')
        return {
          ...base,
          waterActive: true,
          stamina: START_STAMINA,
          sprintLocked: false,
        }
      if (kind === 'blanket')
        return {
          ...base,
          pendingDrop: 'blanket',
          pendingDropPlaced: true,
          dropReq: s.dropReq + 1,
        }
      if (kind === 'decoy') return { ...base, throwReq: s.throwReq + 1 }
      return base
    }),

  // Ditch a slot's item back into the world. Bound to R in App.jsx (drops slot 0
  // — your first item) and to a long-press on a slot button (TouchControls, its
  // own index). The slot clears, the rest pack left, and `pendingDrop` /
  // `dropReq` flag the drop for Drops.jsx to mark on the ground — the 7.5 pip
  // then points you back to it. `pendingDropPlaced` is forced false: R is a
  // plain, re-pocketable drop even for a blanket (only Q sets one down). No-op
  // on an empty slot / finished run / interlude.
  dropSlot: (i) =>
    set((s) => {
      if (s.status !== 'playing' || s.interlude || !s.slots[i]) return {}
      const slots = s.slots.slice()
      const kind = slots[i]
      slots[i] = null
      return {
        slots: compact(slots),
        selectedSlot: 0,
        pendingDrop: kind,
        pendingDropPlaced: false,
        dropReq: s.dropReq + 1,
      }
    }),

  // Consumables.jsx counts each window down and calls these when it's up.
  endSnack: () => set((s) => (s.snackActive ? { snackActive: false } : {})),
  endWater: () => set((s) => (s.waterActive ? { waterActive: false } : {})),

  // 7.6: Drops.jsx calls this on the frame the player steps onto / off a
  // set-down blanket. No timer behind it — the flag tracks the spot.
  setOnBlanket: (on) =>
    set((s) => (s.blanketActive === on ? {} : { blanketActive: on })),

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
        slots: emptySlots(),
        selectedSlot: 0,
        snackActive: false,
        waterActive: false,
        blanketActive: false,
        dropReq: 0,
        pendingDrop: null,
        pendingDropPlaced: false,
        reviveUsed: false,
        graceUntil: 0,
      }
    }),

  // Called every frame while you're in control. Adds real seconds onto the run
  // clock the game-over screen reads back.
  tickTime: (delta) =>
    set((s) => (s.status === 'playing' ? { elapsed: s.elapsed + delta } : {})),

  // Called every frame while you're in control. Drains warmth by `amount` and
  // ends the run the moment it runs out — unless a just-revived player is still
  // in their grace window, when the cold holds off entirely.
  tickWarmth: (amount) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      if (now() < s.graceUntil) return {}
      const warmth = s.warmth - amount
      if (warmth <= 0) return { warmth: 0, status: 'frozen' }
      return { warmth }
    }),

  // Called every frame by the player controller. `draining` is true only when
  // the player is actually sprinting this frame; otherwise the bar regenerates.
  tickStamina: (draining, amount) =>
    set((s) => {
      if (s.status !== 'playing') return {}
      // 6.13 / 7.7: while a snack or a water bottle is working, the bar is welded
      // to full and sprint never locks — the whole point of spending one.
      if (s.snackActive || s.waterActive) {
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
    set((s) => {
      if (s.status !== 'playing') return {}
      if (now() < s.graceUntil) return {} // just revived — a breath before he can grab you
      return { status: 'caught' }
    }),

  // The one-time second chance. Only from a death screen, and only while the
  // revive is unspent. Warmth + stamina back to full and the fumble / consumable
  // flags cleared; the run, score, level and ember counts are untouched. Bumping
  // `reviveReq` tells the scene to put the player back at spawn and send the
  // yeti wide; `graceUntil` buys a few seconds of safety on the way in.
  revivePlayer: () =>
    set((s) => {
      if ((s.status !== 'caught' && s.status !== 'frozen') || s.reviveUsed)
        return {}
      return {
        status: 'playing',
        reviveUsed: true,
        reviveReq: s.reviveReq + 1,
        graceUntil: now() + REVIVE_GRACE_MS,
        warmth: START_WARMTH,
        stamina: START_STAMINA,
        sprintLocked: false,
        snackActive: false,
        waterActive: false,
        blanketActive: false,
      }
    }),

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
      slots: emptySlots(),
      selectedSlot: 0,
      snackActive: false,
      waterActive: false,
      blanketActive: false,
      dropReq: 0,
      pendingDrop: null,
      pendingDropPlaced: false,
      reviveUsed: false,
      graceUntil: 0,
    })),
}))
