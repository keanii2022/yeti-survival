import { describe, it, expect } from 'vitest'
import { sightlineBlocked } from './roar.js'

describe('sightlineBlocked', () => {
  it('is clear with no trees between the two points', () => {
    expect(sightlineBlocked([], 0, 0, 10, 0)).toBe(false)
  })

  it('is blocked by a tree canopy sitting on the segment', () => {
    const trees = [{ position: [5, 0, 0], scale: 1 }]
    expect(sightlineBlocked(trees, 0, 0, 10, 0)).toBe(true)
  })

  it('is clear when the tree sits well off to the side', () => {
    const trees = [{ position: [5, 0, 20], scale: 1 }]
    expect(sightlineBlocked(trees, 0, 0, 10, 0)).toBe(false)
  })

  it('is clear when the tree sits past the far end of the segment', () => {
    const trees = [{ position: [50, 0, 0], scale: 1 }]
    expect(sightlineBlocked(trees, 0, 0, 10, 0)).toBe(false)
  })

  it('scales the canopy radius with the tree scale', () => {
    const trees = [{ position: [5, 0, 1.5], scale: 0.5 }]
    // A small tree's canopy doesn't reach the line...
    expect(sightlineBlocked(trees, 0, 0, 10, 0)).toBe(false)
    // ...but a big one at the same spot does.
    trees[0].scale = 2.5
    expect(sightlineBlocked(trees, 0, 0, 10, 0)).toBe(true)
  })

  it('treats a same-point segment as blocked only when standing inside a canopy', () => {
    const trees = [{ position: [0.2, 0, 0], scale: 1 }]
    expect(sightlineBlocked(trees, 0, 0, 0, 0)).toBe(true)
    expect(sightlineBlocked([{ position: [50, 0, 0], scale: 1 }], 0, 0, 0, 0)).toBe(false)
  })
})
