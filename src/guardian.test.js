import { describe, it, expect } from 'vitest'
import { guardianParams, GUARDIAN_MIN_LEVEL, GUARDIAN_FULL_LEVEL } from './guardian.js'
import { levelParams, LEVEL_COUNT } from './levels.js'
import { DIFFICULTIES } from './difficulty.js'

describe('guardianParams', () => {
  it('8.10: is in every run from level 1', () => {
    expect(GUARDIAN_MIN_LEVEL).toBe(1)
  })

  it('8.10: starts gentle at level 1', () => {
    const p = guardianParams(GUARDIAN_MIN_LEVEL)
    expect(p.aggroRadius).toBe(16)
    expect(p.patrolRadius).toBe(18)
    expect(p.chaseCap).toBe(2)
    expect(p.speed).toBe(5)
    expect(p.commitDelay).toBe(0.6)
  })

  it("8.10: grows into 8.3's original floor by GUARDIAN_FULL_LEVEL", () => {
    const p = guardianParams(GUARDIAN_FULL_LEVEL)
    expect(p.aggroRadius).toBe(22)
    expect(p.patrolRadius).toBe(16)
    expect(p.chaseCap).toBe(3)
    expect(p.speed).toBeCloseTo(5.6)
    expect(p.commitDelay).toBeCloseTo(0.3)
  })

  it('8.10: gets a little stronger every level of the base climb', () => {
    for (let L = GUARDIAN_MIN_LEVEL + 1; L <= LEVEL_COUNT; L++) {
      const prev = guardianParams(L - 1)
      const p = guardianParams(L)
      expect(p.aggroRadius).toBeGreaterThan(prev.aggroRadius)
      expect(p.patrolRadius).toBeLessThan(prev.patrolRadius)
      expect(p.chaseCap).toBeGreaterThan(prev.chaseCap)
      expect(p.speed).toBeGreaterThan(prev.speed)
      expect(p.commitDelay).toBeLessThanOrEqual(prev.commitDelay)
    }
  })

  it("8.10: stays a notch under the Hunter's chase speed at every level and difficulty", () => {
    for (const d of DIFFICULTIES) {
      for (let L = 1; L <= LEVEL_COUNT + 10; L++) {
        expect(guardianParams(L, d).speed).toBeLessThan(levelParams(L, d).chaseSpeed)
      }
    }
  })

  it('8.10: easier difficulties ease him the same way they ease the Hunter', () => {
    const hard = guardianParams(1, 'hard')
    const easy = guardianParams(1, 'easy')
    expect(guardianParams(1)).toEqual(hard)
    expect(easy.speed).toBeLessThan(hard.speed)
    expect(easy.aggroRadius).toBeLessThan(hard.aggroRadius)
    expect(easy.commitDelay).toBeGreaterThan(hard.commitDelay)
    expect(easy.patrolRadius).toBe(hard.patrolRadius)
    expect(easy.chaseCap).toBe(hard.chaseCap)
  })

  it('ramps aggro up and patrol radius down by one level past full strength', () => {
    const p = guardianParams(GUARDIAN_FULL_LEVEL + 1)
    expect(p.aggroRadius).toBe(30)
    expect(p.patrolRadius).toBe(12)
    expect(p.chaseCap).toBe(6)
    expect(p.speed).toBeCloseTo(6.6)
  })

  it('8.6: keeps creeping past one level above full strength instead of flatlining', () => {
    const oneAbove = guardianParams(GUARDIAN_FULL_LEVEL + 1)
    const wayAbove = guardianParams(GUARDIAN_FULL_LEVEL + 5)
    expect(wayAbove.aggroRadius).toBeGreaterThan(oneAbove.aggroRadius)
    expect(wayAbove.patrolRadius).toBeLessThan(oneAbove.patrolRadius)
    expect(wayAbove.chaseCap).toBeGreaterThan(oneAbove.chaseCap)
    expect(wayAbove.speed).toBeGreaterThan(oneAbove.speed)
  })

  it('8.6: still bounds every value even arbitrarily deep into an endless run', () => {
    const p = guardianParams(GUARDIAN_FULL_LEVEL + 500)
    expect(p.patrolRadius).toBeGreaterThanOrEqual(8)
    expect(p.chaseCap).toBeLessThanOrEqual(9)
    expect(p.speed).toBeLessThanOrEqual(9.3)
  })

  it('never goes below the floor for a level under the minimum', () => {
    const p = guardianParams(GUARDIAN_MIN_LEVEL - 3)
    expect(p).toEqual(guardianParams(GUARDIAN_MIN_LEVEL))
  })
})
