// Step 7.4: the carried inventory — four generic slots. A pickup (snack,
// blanket, decoy) drops into the first free slot; there's no key per item type.
// One key (E) cycles which slot is *selected*, the other (Q) spends whatever's
// in it — a one-handed cycle-then-commit, deliberately a beat slower than a
// dedicated key per item (see the README's 7.4 note). `dropSlot` exists in the
// store but isn't bound to anything yet: you can't fill four slots until 7.7+
// adds more consumables, and a dropped item is invisible until the 7.5 pip.
//
// Pure helpers + constants only here — no three, no React, no store — so the
// wiring in App.jsx / TouchControls / Player stays thin and this stays cheap to
// unit-test.

export const SLOT_COUNT = 4

// Using — or dropping — an item pins you to walk speed for this many seconds:
// the "both hands busy for a beat" cost the README floats. Player.jsx counts it
// down off the `inventory` singleton so a pause freezes it. Playtest-tunable.
export const USE_WALK_LOCK_SECONDS = 0.8

// Short human labels for the HUD chips / on-screen buttons, keyed by item kind.
export const ITEM_LABEL = { snack: 'Snack', blanket: 'Blanket', decoy: 'Decoy' }

// Index of the first empty (null / undefined) slot in `slots`, or -1 when the
// inventory is full. Where a fresh pickup lands.
export function firstFreeSlot(slots) {
  for (let i = 0; i < slots.length; i++) if (slots[i] == null) return i
  return -1
}

// Is there room for one more pickup?
export function hasFreeSlot(slots) {
  return firstFreeSlot(slots) !== -1
}

// The next filled slot after `from`, wrapping. Returns `from` unchanged when no
// *other* slot holds anything (one item, or none) — E then does nothing.
export function nextFilledSlot(slots, from) {
  for (let step = 1; step <= slots.length; step++) {
    const i = (from + step) % slots.length
    if (slots[i] != null) return i
  }
  return from
}

// The slot the selection should land on after a slot empties (a use, a drop):
// keep `prefer` if it still holds something, else the lowest filled slot, else
// `prefer` so the index stays in range for an empty inventory.
export function firstFilledSlot(slots, prefer) {
  if (slots[prefer] != null) return prefer
  for (let i = 0; i < slots.length; i++) if (slots[i] != null) return i
  return prefer
}

// The walk-speed-lock singleton. `walkLock` counts *down* in seconds inside
// Player's frame loop (so a pause freezes it); anything > 0 clamps the player
// to walk speed. App.jsx / TouchControls call lockWalk() on a use.
export const inventory = { walkLock: 0 }

export function lockWalk(seconds = USE_WALK_LOCK_SECONDS) {
  inventory.walkLock = Math.max(inventory.walkLock, seconds)
}

// Wipe it on a fresh scene (mount / restart) so a lock that started the instant
// before a game-over can't bleed into the next run.
export function resetInventory() {
  inventory.walkLock = 0
}
