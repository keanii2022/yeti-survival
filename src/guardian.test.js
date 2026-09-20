import { describe, it, expect } from 'vitest'
import { guardianParams, GUARDIAN_MIN_LEVEL } from './guardian.js'

describe('guardianParams', () => {
  it('is at the floor of its ramp at the minimum level', () => {
    const p = guardianParams(GUARDIAN_MIN_LEVEL)
    expect(p.aggroRadius).toBe(22)
    expect(p.patrolRadius).toBe(16)
    expect(p.chaseCap).toBe(3)
    expect(p.speed).toBe(5.6)
  })

  it('ramps aggro up and patrol radius down by one level higher', () => {
    const p = guardianParams(GUARDIAN_MIN_LEVEL + 1)
    expect(p.aggroRadius).toBeGreaterThan(22)
    expect(p.patrolRadius).toBeLessThan(16)
    expect(p.chaseCap).toBeGreaterThan(3)
    expect(p.speed).toBeGreaterThan(5.6)
  })

  it('clamps at the ceiling rather than climbing past one level above the floor', () => {
    const oneAbove = guardianParams(GUARDIAN_MIN_LEVEL + 1)
    const wayAbove = guardianParams(GUARDIAN_MIN_LEVEL + 5)
    expect(wayAbove).toEqual(oneAbove)
  })

  it('never goes below the floor for a level under the minimum', () => {
    const p = guardianParams(GUARDIAN_MIN_LEVEL - 3)
    expect(p).toEqual(guardianParams(GUARDIAN_MIN_LEVEL))
  })
})
