import { describe, it, expect } from 'vitest'
import { todaySeedValue, dailyRandom, reseedDaily } from './dailySeed.js'

describe('todaySeedValue', () => {
  it('encodes the local calendar date as YYYYMMDD', () => {
    expect(todaySeedValue(new Date(2026, 2, 5))).toBe(20260305)
    expect(todaySeedValue(new Date(2026, 11, 31))).toBe(20261231)
  })
})

describe('reseedDaily / dailyRandom', () => {
  it('produces the same sequence of draws for the same date', () => {
    reseedDaily(new Date(2026, 5, 1))
    const first = [dailyRandom(), dailyRandom(), dailyRandom()]
    reseedDaily(new Date(2026, 5, 1))
    const second = [dailyRandom(), dailyRandom(), dailyRandom()]
    expect(second).toEqual(first)
  })

  it('produces a different sequence for a different date', () => {
    reseedDaily(new Date(2026, 5, 1))
    const day1 = [dailyRandom(), dailyRandom(), dailyRandom()]
    reseedDaily(new Date(2026, 5, 2))
    const day2 = [dailyRandom(), dailyRandom(), dailyRandom()]
    expect(day2).not.toEqual(day1)
  })

  it('stays within [0, 1) like Math.random', () => {
    reseedDaily(new Date(2026, 0, 1))
    for (let i = 0; i < 50; i++) {
      const v = dailyRandom()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
