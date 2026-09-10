import { describe, it, expect, afterEach } from 'vitest'
import { daylight, NIGHT_CUTOFF, isNight, resetDaylight } from './daylight.js'

// daylight.js is the off-React mirror of World.jsx's day dial. The only logic
// here is the night threshold the 7.7 consumable picker reads — pin that and
// the reset.

afterEach(resetDaylight)

describe('isNight', () => {
  it('is false through dusk, true once past the cutoff', () => {
    daylight.night = 0
    expect(isNight()).toBe(false)

    daylight.night = NIGHT_CUTOFF - 0.01
    expect(isNight()).toBe(false)

    daylight.night = NIGHT_CUTOFF
    expect(isNight()).toBe(true)

    daylight.night = 1
    expect(isNight()).toBe(true)
  })
})

describe('resetDaylight', () => {
  it('zeroes the dial so a fresh run does not read the last one', () => {
    daylight.u = 0.9
    daylight.night = 1
    resetDaylight()
    expect(daylight.u).toBe(0)
    expect(daylight.night).toBe(0)
    expect(isNight()).toBe(false)
  })
})
