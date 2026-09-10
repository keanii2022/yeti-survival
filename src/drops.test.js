import { describe, it, expect, beforeEach } from 'vitest'
import {
  drops,
  addDrop,
  removeDrop,
  resetDrops,
  screenBearing,
  fuzzBearing,
  nearestDrop,
  blanketUnderfoot,
} from './drops.js'

// Step 7.5 pure bits: the drop list, the facing-relative bearing math, and the
// 8-sector snap that makes the HUD arrow read as a rough heading. Drops.jsx
// wires these to the camera; the arrow itself is eyeballed in a playtest.

beforeEach(() => resetDrops())

const QUARTER = Math.PI / 2

describe('drop list', () => {
  it('addDrop appends an entry with a stable id and returns it', () => {
    const a = addDrop('snack', 1, 2)
    const b = addDrop('blanket', -3, 4)
    expect(drops.list).toEqual([a, b])
    expect(a.id).not.toBe(b.id)
    expect(a).toMatchObject({ kind: 'snack', x: 1, z: 2, placed: false })
  })

  it('addDrop carries the placed flag (7.6 set-down blanket)', () => {
    const plain = addDrop('snack', 0, 0)
    const laid = addDrop('blanket', 5, 5, true)
    expect(plain.placed).toBe(false)
    expect(laid.placed).toBe(true)
  })

  it('removeDrop drops just that entry', () => {
    const a = addDrop('snack', 1, 2)
    const b = addDrop('blanket', -3, 4)
    removeDrop(a)
    expect(drops.list).toEqual([b])
    removeDrop(a) // already gone — no throw, no change
    expect(drops.list).toEqual([b])
  })

  it('resetDrops clears the list, the pip, and the on-blanket flag', () => {
    addDrop('decoy', 5, 5)
    drops.bearing = 1.2
    drops.onBlanket = true
    resetDrops()
    expect(drops.list).toEqual([])
    expect(drops.bearing).toBeNull()
    expect(drops.onBlanket).toBe(false)
  })
})

describe('screenBearing', () => {
  // Camera facing -Z (three.js forward at yaw 0); +X is screen-right.
  const FWD = [0, -1]

  it('reads ~0 for a target dead ahead', () => {
    expect(screenBearing(...FWD, 0, -10)).toBeCloseTo(0)
  })

  it('is positive to the right, negative to the left', () => {
    expect(screenBearing(...FWD, 8, 0)).toBeCloseTo(QUARTER)
    expect(screenBearing(...FWD, -8, 0)).toBeCloseTo(-QUARTER)
  })

  it('reads ±PI for a target directly behind', () => {
    expect(Math.abs(screenBearing(...FWD, 0, 6))).toBeCloseTo(Math.PI)
  })

  it('falls back to ahead when a vector is zero-length', () => {
    expect(screenBearing(0, 0, 3, 4)).toBe(0)
    expect(screenBearing(0, -1, 0, 0)).toBe(0)
  })
})

describe('fuzzBearing', () => {
  it('snaps to the nearest of 8 headings', () => {
    const step = Math.PI / 4
    expect(fuzzBearing(0.1)).toBeCloseTo(0)
    expect(fuzzBearing(0.7)).toBeCloseTo(step)
    expect(fuzzBearing(-0.7)).toBeCloseTo(-step)
    expect(fuzzBearing(Math.PI)).toBeCloseTo(Math.PI)
    expect(fuzzBearing(QUARTER)).toBeCloseTo(QUARTER)
  })

  it('honours a custom sector count', () => {
    expect(fuzzBearing(1.0, 4)).toBeCloseTo(QUARTER) // step PI/2, 1.0 -> PI/2
    expect(fuzzBearing(0.3, 4)).toBeCloseTo(0)
  })
})

describe('nearestDrop', () => {
  it('returns null with nothing dropped', () => {
    expect(nearestDrop(0, 0)).toBeNull()
  })

  it('picks the closest entry to the point', () => {
    addDrop('snack', 10, 0)
    const near = addDrop('blanket', 1, 1)
    addDrop('decoy', -20, -20)
    expect(nearestDrop(0, 0)).toBe(near)
  })

  it('honours a predicate — the closest re-pocketable drop skips a placed blanket', () => {
    const laid = addDrop('blanket', 1, 0, true) // right underfoot, but placed
    const grab = addDrop('snack', 6, 0) // further, but a plain drop
    expect(nearestDrop(0, 0)).toBe(laid) // pip target: any entry
    expect(nearestDrop(0, 0, (e) => !e.placed)).toBe(grab) // re-pickup target
  })

  it('predicate can rule out every entry', () => {
    addDrop('blanket', 2, 2, true)
    expect(nearestDrop(0, 0, (e) => !e.placed)).toBeNull()
  })
})

describe('blanketUnderfoot', () => {
  it('is false with no placed blanket, even sat on a plain drop', () => {
    addDrop('snack', 0, 0)
    expect(blanketUnderfoot(0, 0, 1.8)).toBe(false)
  })

  it('is true only inside a placed blanket radius', () => {
    addDrop('blanket', 10, 0, true)
    expect(blanketUnderfoot(9, 0, 1.8)).toBe(true) // 1u away
    expect(blanketUnderfoot(10, 1.5, 1.8)).toBe(true) // 1.5u away
    expect(blanketUnderfoot(7, 0, 1.8)).toBe(false) // 3u away
  })
})
