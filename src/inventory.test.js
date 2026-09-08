import { describe, it, expect, beforeEach } from 'vitest'
import {
  SLOT_COUNT,
  USE_WALK_LOCK_SECONDS,
  firstFreeSlot,
  hasFreeSlot,
  nextFilledSlot,
  firstFilledSlot,
  inventory,
  lockWalk,
  resetInventory,
} from './inventory.js'

// Step 7.4 pure helpers: the free-slot search, the E-cycle / post-use selection
// math, and the walk-lock singleton. The key wiring (E cycle, Q use) lives in
// App.jsx and is exercised by hand in a playtest.

beforeEach(() => resetInventory())

describe('slot constants', () => {
  it('is four slots with a positive walk-lock window', () => {
    expect(SLOT_COUNT).toBe(4)
    expect(USE_WALK_LOCK_SECONDS).toBeGreaterThan(0)
  })
})

describe('firstFreeSlot / hasFreeSlot', () => {
  it('finds the lowest null slot', () => {
    expect(firstFreeSlot([null, null, null, null])).toBe(0)
    expect(firstFreeSlot(['snack', null, null, null])).toBe(1)
    expect(firstFreeSlot(['snack', 'blanket', null, 'decoy'])).toBe(2)
  })

  it('reports -1 / false when every slot is taken', () => {
    const full = ['snack', 'snack', 'blanket', 'decoy']
    expect(firstFreeSlot(full)).toBe(-1)
    expect(hasFreeSlot(full)).toBe(false)
    expect(hasFreeSlot(['snack', null, 'decoy', 'blanket'])).toBe(true)
  })
})

describe('nextFilledSlot', () => {
  it('advances to the next filled slot, wrapping past empties', () => {
    const slots = ['snack', null, 'blanket', null]
    expect(nextFilledSlot(slots, 0)).toBe(2)
    expect(nextFilledSlot(slots, 2)).toBe(0)
  })

  it('stays put when nothing else is carried', () => {
    expect(nextFilledSlot(['snack', null, null, null], 0)).toBe(0)
    expect(nextFilledSlot([null, null, null, null], 1)).toBe(1)
  })
})

describe('firstFilledSlot', () => {
  it('keeps the preferred slot when it still holds something', () => {
    expect(firstFilledSlot(['snack', 'blanket', null, null], 1)).toBe(1)
  })

  it('falls to the lowest filled slot when the preferred one emptied', () => {
    expect(firstFilledSlot([null, null, 'decoy', null], 0)).toBe(2)
  })

  it('leaves the index in range for an empty inventory', () => {
    expect(firstFilledSlot([null, null, null, null], 3)).toBe(3)
  })
})

describe('walk-lock singleton', () => {
  it('lockWalk sets the window and only ever extends it', () => {
    lockWalk(0.5)
    expect(inventory.walkLock).toBe(0.5)
    lockWalk(0.2) // shorter — must not cut the running lock short
    expect(inventory.walkLock).toBe(0.5)
    lockWalk(1.2)
    expect(inventory.walkLock).toBe(1.2)
  })

  it('defaults to USE_WALK_LOCK_SECONDS', () => {
    lockWalk()
    expect(inventory.walkLock).toBe(USE_WALK_LOCK_SECONDS)
  })

  it('resetInventory clears it', () => {
    lockWalk(1)
    resetInventory()
    expect(inventory.walkLock).toBe(0)
  })
})
