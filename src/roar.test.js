import { describe, it, expect } from 'vitest'
import {
  sightlineBlocked,
  createRoarTimer,
  stepRoar,
  roarTelegraph,
  ROAR_WINDUP,
  ROAR_FIRST_MIN,
  ROAR_FIRST_VAR,
  ROAR_REPEAT_MIN,
} from './roar.js'

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

const fixedRng = (v) => () => v
const DT = 1 / 60

// Run `seconds` of frames; returns the times (in seconds) a roar landed.
function run(timer, seconds, chasing = true, rng = fixedRng(0)) {
  const landed = []
  const frames = Math.round(seconds / DT)
  for (let i = 1; i <= frames; i++) {
    if (stepRoar(timer, chasing, DT, rng)) landed.push(i * DT)
  }
  return landed
}

describe('stepRoar', () => {
  it('fires a few seconds into a fresh chase (8.8), not 9+', () => {
    const r = createRoarTimer()
    const landed = run(r, 6)
    expect(landed.length).toBe(1)
    // The wait plus the planted windup.
    expect(landed[0]).toBeCloseTo(ROAR_FIRST_MIN + ROAR_WINDUP, 1)
    expect(landed[0]).toBeLessThan(5)
  })

  it('never takes longer than the slowest first roll plus the windup', () => {
    const r = createRoarTimer()
    const landed = run(r, ROAR_FIRST_MIN + ROAR_FIRST_VAR + ROAR_WINDUP + 0.1, true, fixedRng(0.999))
    expect(landed.length).toBe(1)
  })

  it('spaces a second roar in the same chase out by the longer repeat gap', () => {
    const r = createRoarTimer()
    const landed = run(r, 20)
    expect(landed.length).toBe(2)
    expect(landed[1] - landed[0]).toBeCloseTo(ROAR_REPEAT_MIN + ROAR_WINDUP, 1)
  })

  it('stands planted with a rising telegraph through the windup', () => {
    const r = createRoarTimer()
    run(r, ROAR_FIRST_MIN + 0.05)
    expect(r.phase).toBe('windup')
    const early = roarTelegraph(r)
    run(r, ROAR_WINDUP / 2)
    expect(roarTelegraph(r)).toBeGreaterThan(early)
    expect(roarTelegraph(r)).toBeLessThanOrEqual(1)
  })

  it('does nothing while he is not chasing', () => {
    const r = createRoarTimer()
    expect(run(r, 30, false).length).toBe(0)
    expect(roarTelegraph(r)).toBe(0)
  })

  it('cancels a windup when the chase breaks off, and a new chase rolls the short wait again', () => {
    const r = createRoarTimer()
    run(r, ROAR_FIRST_MIN + 0.3) // mid-windup
    expect(r.phase).toBe('windup')
    stepRoar(r, false, DT, fixedRng(0)) // shaken off
    expect(r.phase).toBe('idle')
    expect(roarTelegraph(r)).toBe(0)
    const landed = run(r, 6)
    expect(landed[0]).toBeCloseTo(ROAR_FIRST_MIN + ROAR_WINDUP, 1)
  })
})
