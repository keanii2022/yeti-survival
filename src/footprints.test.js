import { describe, it, expect, beforeEach } from 'vitest'
import {
  trail,
  stampPrint,
  ageTrail,
  resetTrail,
  livePrints,
  trailToFollow,
  TRAIL_CAPACITY,
  PRINT_SPACING,
  PRINT_TTL,
} from './footprints.js'

// footprints.js is the 7.3 trail: a fixed ring the player stamps into and an
// investigating yeti walks back out. Pure over plain {x,z} plus a bit of ring
// bookkeeping, so it's easy to drive step by step here.

beforeEach(() => resetTrail())

describe('stampPrint', () => {
  it('lays the first print unconditionally and seeds the trail', () => {
    expect(stampPrint(10, 5)).toBe(true)
    expect(livePrints()).toEqual([{ x: 10, z: 5 }])
    expect(trail.seeded).toBe(true)
  })

  it('holds off until the player has moved PRINT_SPACING', () => {
    stampPrint(0, 0)
    expect(stampPrint(PRINT_SPACING - 0.2, 0)).toBe(false)
    expect(stampPrint(PRINT_SPACING + 0.2, 0)).toBe(true)
    expect(livePrints()).toHaveLength(2)
  })

  it('faces each print along the stride', () => {
    stampPrint(0, 0)
    stampPrint(0, 5) // walked straight along +z
    expect(trail.slots[1].rot).toBeCloseTo(0, 6)
    resetTrail()
    stampPrint(0, 0)
    stampPrint(5, 0) // walked along +x
    expect(trail.slots[1].rot).toBeCloseTo(Math.PI / 2, 6)
  })

  it('recycles the oldest slot once the ring is full', () => {
    for (let i = 0; i < TRAIL_CAPACITY + 5; i++) stampPrint(i * PRINT_SPACING * 1.1, 0)
    const live = livePrints()
    expect(live).toHaveLength(TRAIL_CAPACITY)
    // The five oldest prints have been overwritten by the newest five.
    expect(live[0].x).toBeCloseTo(5 * PRINT_SPACING * 1.1, 6)
  })
})

describe('ageTrail', () => {
  it('retires a print once it passes PRINT_TTL', () => {
    stampPrint(1, 1)
    ageTrail(PRINT_TTL - 0.1)
    expect(livePrints()).toHaveLength(1)
    ageTrail(0.2)
    expect(livePrints()).toHaveLength(0)
  })
})

describe('livePrints', () => {
  it('returns the prints oldest → newest', () => {
    stampPrint(0, 0)
    stampPrint(0, 2)
    stampPrint(0, 4)
    expect(livePrints()).toEqual([
      { x: 0, z: 0 },
      { x: 0, z: 2 },
      { x: 0, z: 4 },
    ])
  })
})

describe('trailToFollow', () => {
  it('is empty when nothing has been stamped', () => {
    expect(trailToFollow(0, 0)).toEqual([])
  })

  it('starts at the print nearest the yeti and runs to the newest', () => {
    // A straight trail along +z from 0 to 10.
    for (let z = 0; z <= 10; z += 2) stampPrint(0, z)
    // Yeti standing next to the z=6 print picks it up there, not from z=0.
    const path = trailToFollow(0.3, 6)
    expect(path[0]).toEqual({ x: 0, z: 6 })
    expect(path[path.length - 1]).toEqual({ x: 0, z: 10 })
    expect(path).toHaveLength(3) // z = 6, 8, 10
  })

  it('drops faded prints from the followable path', () => {
    stampPrint(0, 0)
    ageTrail(PRINT_TTL + 1) // the z=0 print is gone
    stampPrint(0, 2)
    stampPrint(0, 4)
    expect(trailToFollow(0, 0)).toEqual([
      { x: 0, z: 2 },
      { x: 0, z: 4 },
    ])
  })
})
