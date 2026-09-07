import { describe, it, expect } from 'vitest'
import {
  joystickVector,
  sprintLatch,
  JOYSTICK_BASE_RADIUS,
  JOYSTICK_DEADZONE,
  SPRINT_LATCH_RATIO,
} from './joystick.js'

// 9.2's pure bits: the thumb-offset -> move-vector map and the sprint latch's
// hysteresis. TouchControls.jsx owns the event plumbing and the visual.

const R = JOYSTICK_BASE_RADIUS

describe('joystickVector', () => {
  it('is zero inside the deadzone', () => {
    const dead = R * JOYSTICK_DEADZONE
    expect(joystickVector(dead - 1, 0).mag).toBe(0)
    expect(joystickVector(0, 0)).toEqual({ x: 0, y: 0, mag: 0 })
  })

  it('reaches full magnitude at the base radius', () => {
    expect(joystickVector(R, 0).mag).toBeCloseTo(1)
    expect(joystickVector(0, -R).mag).toBeCloseTo(1)
  })

  it('clamps magnitude to 1 past the base radius', () => {
    expect(joystickVector(R * 3, 0).mag).toBe(1)
  })

  it('scales roughly linearly between the deadzone and the ring', () => {
    const dead = R * JOYSTICK_DEADZONE
    const mid = dead + (R - dead) / 2
    expect(joystickVector(mid, 0).mag).toBeCloseTo(0.5)
  })

  it('points screen-up as forward (+y) and screen-down as backward (-y)', () => {
    expect(joystickVector(0, -R).y).toBeGreaterThan(0)
    expect(joystickVector(0, R).y).toBeLessThan(0)
  })

  it('points right drag to +x', () => {
    expect(joystickVector(R, 0).x).toBeGreaterThan(0)
    expect(joystickVector(-R, 0).x).toBeLessThan(0)
  })

  it('keeps the vector on the unit circle at full throw', () => {
    const v = joystickVector(R, -R) // 45 degrees, well past the ring
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1)
  })
})

describe('sprintLatch', () => {
  const latchAt = R * SPRINT_LATCH_RATIO

  it('latches once the thumb passes the sprint ring', () => {
    expect(sprintLatch(false, latchAt + 1)).toBe(true)
  })

  it('holds while in the band between the base radius and the ring', () => {
    const between = (R + latchAt) / 2
    expect(sprintLatch(true, between)).toBe(true)
    expect(sprintLatch(false, between)).toBe(false)
  })

  it('releases when pulled back inside the base radius', () => {
    expect(sprintLatch(true, R - 1)).toBe(false)
  })

  it('does not re-latch from a pull-back at the base radius without crossing the ring again', () => {
    const inBand = (R + latchAt) / 2 // between the base radius and the sprint ring
    let s = sprintLatch(false, latchAt + 5) // latched
    s = sprintLatch(s, R) // back to the ring edge -> released
    expect(s).toBe(false)
    s = sprintLatch(s, inBand) // in the band, not past the sprint ring
    expect(s).toBe(false)
  })
})
