import { describe, it, expect } from 'vitest'
import {
  TREE_COUNT,
  TREE_SPREAD,
  generateTrees,
  resolveTreeCollision,
} from './trees.js'

// trees.js is the 6.9 collision fallback: a fixed-seed scatter plus a pure
// circle-vs-circle push-out over plain {x, z}. Both halves are easy to pin down
// here; the feel of the radii is left to playtesting.

describe('generateTrees', () => {
  it('places exactly TREE_COUNT trees, identically every call', () => {
    const a = generateTrees()
    const b = generateTrees()
    expect(a).toHaveLength(TREE_COUNT)
    expect(b).toEqual(a)
  })

  it('keeps the spawn circle clear and stays within the spread', () => {
    for (const t of generateTrees()) {
      const [x, , z] = t.position
      expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(7)
      expect(Math.abs(x)).toBeLessThanOrEqual(TREE_SPREAD)
      expect(Math.abs(z)).toBeLessThanOrEqual(TREE_SPREAD)
      expect(t.collideR).toBeGreaterThan(0)
    }
  })
})

describe('resolveTreeCollision', () => {
  const trees = [
    { position: [0, 0, 0], collideR: 0.5 },
    { position: [3, 0, 0], collideR: 0.5 },
  ]
  const out = { x: 0, z: 0 }

  it('leaves a point outside every trunk untouched', () => {
    resolveTreeCollision(trees, 10, -4, 0.4, out)
    expect(out).toEqual({ x: 10, z: -4 })
  })

  it('pushes an overlapping body out to exactly trunk + body radius', () => {
    resolveTreeCollision(trees, 0.2, 0, 0.4, out)
    // pushed along +x (the side it entered from) to the contact distance
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(0.9, 6)
    expect(out.x).toBeGreaterThan(0)
    expect(out.z).toBeCloseTo(0, 6)
  })

  it('only lets an overlapped trunk contribute a push', () => {
    // Just inside trunk B, well clear of trunk A — the result must clear B and
    // must not have been nudged by A.
    resolveTreeCollision(trees, 3.2, 0, 0.4, out)
    expect(Math.hypot(out.x - 3, out.z)).toBeCloseTo(0.9, 6)
    expect(out.x).toBeGreaterThan(3)
  })

  it('leaves the corridor between two spaced trunks passable', () => {
    // Dead centre between the trunks (1.5, 0): 1.5 from each, past both 0.9
    // keep-out circles, so a body walking the gap is untouched.
    resolveTreeCollision(trees, 1.5, 0, 0.4, out)
    expect(out).toEqual({ x: 1.5, z: 0 })
  })

  it('ignores a body sitting dead-centre rather than dividing by zero', () => {
    resolveTreeCollision(trees, 0, 0, 0.4, out)
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
  })
})
