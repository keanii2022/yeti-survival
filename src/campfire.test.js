import { describe, it, expect } from 'vitest'
import {
  CAMPFIRE_COUNT,
  CAMPFIRE_RADIUS,
  generateCampfires,
  nearCampfire,
  campfireGlow,
  resetCampfireGlow,
} from './campfire.js'

// campfire.js is the 7.14 layer: a fixed-seed scatter of fires plus a pure
// proximity check, same testable split as sheds.js / pond.js.

describe('generateCampfires', () => {
  it('places exactly CAMPFIRE_COUNT fires, identically every call', () => {
    const a = generateCampfires()
    const b = generateCampfires()
    expect(a).toHaveLength(CAMPFIRE_COUNT)
    expect(b).toEqual(a)
  })

  it('keeps them inside the arena, off the spawn, and spaced apart', () => {
    const campfires = generateCampfires()
    for (const c of campfires) {
      expect(Math.hypot(c.x - 0, c.z - 8)).toBeGreaterThan(17)
      expect(Math.abs(c.x)).toBeLessThan(48)
      expect(Math.abs(c.z)).toBeLessThan(48)
    }
    for (let i = 0; i < campfires.length; i++) {
      for (let j = i + 1; j < campfires.length; j++) {
        expect(
          Math.hypot(campfires[i].x - campfires[j].x, campfires[i].z - campfires[j].z),
        ).toBeGreaterThan(27)
      }
    }
  })
})

describe('nearCampfire', () => {
  const campfires = [{ x: 10, z: -5 }]

  it('is true inside the radius and false well outside', () => {
    expect(nearCampfire(campfires, 10, -5)).toBe(true)
    expect(nearCampfire(campfires, 10 + CAMPFIRE_RADIUS - 0.5, -5)).toBe(true)
    expect(nearCampfire(campfires, 40, -5)).toBe(false)
  })

  it('is false just past the radius', () => {
    expect(nearCampfire(campfires, 10 + CAMPFIRE_RADIUS + 0.1, -5)).toBe(false)
  })

  it('takes a custom radius', () => {
    expect(nearCampfire(campfires, 10 + 8, -5, 10)).toBe(true)
    expect(nearCampfire(campfires, 10 + 8, -5, 5)).toBe(false)
  })
})

describe('resetCampfireGlow', () => {
  it('clears the near flag', () => {
    campfireGlow.near = true
    resetCampfireGlow()
    expect(campfireGlow.near).toBe(false)
  })
})
