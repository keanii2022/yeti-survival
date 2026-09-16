import { describe, it, expect } from 'vitest'
import { POND_COUNT, POND_RADIUS, generatePonds, pointInsidePond, resolvePondCollision } from './pond.js'

// pond.js is the 7.13 frozen-pond layer: a fixed-seed scatter of ice sheets
// plus a pure kinematic push-out, same testable split as sheds.js / trees.js.

describe('generatePonds', () => {
  it('places exactly POND_COUNT ponds, identically every call', () => {
    const a = generatePonds()
    const b = generatePonds()
    expect(a).toHaveLength(POND_COUNT)
    expect(b).toEqual(a)
  })

  it('keeps them inside the arena, off the spawn, and spaced apart', () => {
    const ponds = generatePonds()
    for (const p of ponds) {
      expect(Math.hypot(p.x - 0, p.z - 8)).toBeGreaterThan(17)
      expect(Math.abs(p.x)).toBeLessThan(46)
      expect(Math.abs(p.z)).toBeLessThan(46)
      expect(p.radius).toBe(POND_RADIUS)
    }
    for (let i = 0; i < ponds.length; i++) {
      for (let j = i + 1; j < ponds.length; j++) {
        expect(Math.hypot(ponds[i].x - ponds[j].x, ponds[i].z - ponds[j].z)).toBeGreaterThan(29)
      }
    }
  })
})

describe('pointInsidePond', () => {
  const pond = { x: 10, z: -5, radius: 8 }

  it('is true at the centre and false well outside', () => {
    expect(pointInsidePond(pond, 10, -5)).toBe(true)
    expect(pointInsidePond(pond, 40, -5)).toBe(false)
  })

  it('is false just past the rim', () => {
    expect(pointInsidePond(pond, 10 + 8.1, -5)).toBe(false)
  })
})

describe('resolvePondCollision', () => {
  const ponds = [{ x: 0, z: 0, radius: 8 }]
  const out = { x: 0, z: 0 }

  it('leaves a point well clear of every pond untouched', () => {
    resolvePondCollision(ponds, 40, 40, 0.9, out)
    expect(out).toEqual({ x: 40, z: 40 })
  })

  it('shoves a body back out to the rim plus its own radius', () => {
    // Just inside the ice, heading for the centre.
    resolvePondCollision(ponds, 7.9, 0, 0.9, out)
    expect(out.x).toBeCloseTo(8 + 0.9, 5)
    expect(out.z).toBeCloseTo(0, 5)
  })

  it('never lets a body reach the interior at all', () => {
    resolvePondCollision(ponds, 1, 1, 0.9, out)
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(8 + 0.9, 5)
  })
})
