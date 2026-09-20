import { describe, it, expect } from 'vitest'
import {
  weather,
  resetWeather,
  tickWeather,
  intoWindFactor,
  _forceEvent,
  GUST_DURATION,
  SLEET_DURATION,
  GUST_INTERVAL_MIN,
} from './weather.js'

// weather.js is the 7.16 layer: discrete, randomly-scheduled gust/sleet
// events with a ramped envelope. The schedule itself rides on dailyRandom()
// (8.4) (same untested-by-design shape as decoy.js/poop.js), so these tests
// pin the deterministic pieces: the envelope shape via _forceEvent, and the
// pure intoWindFactor calc.

describe('resetWeather', () => {
  it('clears to no active event', () => {
    _forceEvent('gust', 3)
    resetWeather()
    expect(weather.type).toBe(null)
    expect(weather.gustAmount).toBe(0)
    expect(weather.sleetAmount).toBe(0)
  })
})

describe('event envelope', () => {
  it('ramps up from 0 at the very start', () => {
    _forceEvent('gust', 0)
    expect(weather.gustAmount).toBe(0)
  })

  it('is at full strength across the middle', () => {
    _forceEvent('gust', GUST_DURATION / 2)
    expect(weather.gustAmount).toBe(1)
  })

  it('ramps back down toward the end', () => {
    _forceEvent('sleet', SLEET_DURATION - 0.1)
    expect(weather.sleetAmount).toBeGreaterThan(0)
    expect(weather.sleetAmount).toBeLessThan(1)
  })

  it('clears the event once tickWeather crosses its duration', () => {
    _forceEvent('gust', GUST_DURATION - 0.05)
    tickWeather(0.1)
    expect(weather.type).toBe(null)
    expect(weather.gustAmount).toBe(0)
  })

  it('does nothing before the next event is due', () => {
    resetWeather()
    tickWeather(GUST_INTERVAL_MIN - 1)
    expect(weather.type).toBe(null)
  })
})

describe('intoWindFactor', () => {
  it('is 0 standing still', () => {
    _forceEvent('gust', GUST_DURATION / 2, 0, -1)
    expect(intoWindFactor(0, 0)).toBe(0)
  })

  it('is 1 walking straight upwind', () => {
    _forceEvent('gust', GUST_DURATION / 2, 0, -1) // wind blowing toward -z
    expect(intoWindFactor(0, 1)).toBeCloseTo(1) // walking +z, into the wind
  })

  it('is 0 walking with the wind', () => {
    _forceEvent('gust', GUST_DURATION / 2, 0, -1)
    expect(intoWindFactor(0, -1)).toBe(0)
  })

  it('is 0 crossing the wind at a right angle', () => {
    _forceEvent('gust', GUST_DURATION / 2, 0, -1)
    expect(intoWindFactor(1, 0)).toBeCloseTo(0)
  })
})
