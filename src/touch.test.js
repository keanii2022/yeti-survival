import { describe, it, expect } from 'vitest'
import {
  detectCoarsePointer,
  inControl,
  inLookZone,
  applyDragLook,
  DRAG_LOOK_SENSITIVITY,
  PITCH_LIMIT,
} from './touch.js'

// 9.1's pure bits: coarse-pointer detection, the look-zone split, and the
// drag-look yaw/pitch math. Player.jsx owns the event plumbing; this pins the
// numbers an autonomous run can't feel on a real phone.

describe('detectCoarsePointer', () => {
  const mm = (matches) => () => ({ matches })

  it('reads the (pointer: coarse) media query', () => {
    expect(detectCoarsePointer(mm(true))).toBe(true)
    expect(detectCoarsePointer(mm(false))).toBe(false)
  })

  it('is false when matchMedia is missing', () => {
    expect(detectCoarsePointer(undefined)).toBe(false)
  })

  it('is false when matchMedia throws instead of returning false', () => {
    expect(
      detectCoarsePointer(() => {
        throw new Error('bad query')
      }),
    ).toBe(false)
  })
})

describe('inControl', () => {
  it('is always true on a touch device, pointer lock or not', () => {
    expect(inControl(true, {})).toBe(true)
    expect(inControl(true, { pointerLockElement: {} })).toBe(true)
  })

  it('needs a live pointer lock on desktop', () => {
    expect(inControl(false, { pointerLockElement: {} })).toBe(true)
    expect(inControl(false, { pointerLockElement: null })).toBe(false)
  })

  it('is false on desktop when there is no document', () => {
    expect(inControl(false, undefined)).toBe(false)
  })
})

describe('inLookZone', () => {
  // 812-wide landscape phone: LOOK_ZONE_FRACTION 0.55 -> boundary at x = 365.4.
  it('accepts a touch on the right side', () => {
    expect(inLookZone(600, 812)).toBe(true)
    expect(inLookZone(812, 812)).toBe(true)
  })

  it('rejects a touch on the left side', () => {
    expect(inLookZone(100, 812)).toBe(false)
    expect(inLookZone(0, 812)).toBe(false)
  })

  it('sits the boundary at (1 - fraction) of the width', () => {
    expect(inLookZone(365, 812)).toBe(false)
    expect(inLookZone(366, 812)).toBe(true)
  })

  it('is false for a zero / unknown viewport width', () => {
    expect(inLookZone(400, 0)).toBe(false)
  })
})

describe('applyDragLook', () => {
  it('turns yaw opposite the horizontal drag, scaled by sensitivity', () => {
    const { yaw } = applyDragLook(0, 0, 100, 0)
    expect(yaw).toBeCloseTo(-100 * DRAG_LOOK_SENSITIVITY)
  })

  it('pitches down for a downward drag', () => {
    const { pitch } = applyDragLook(0, 0, 0, 50)
    expect(pitch).toBeCloseTo(-50 * DRAG_LOOK_SENSITIVITY)
  })

  it('leaves yaw unclamped so the view can spin all the way round', () => {
    const { yaw } = applyDragLook(6, 0, -2000, 0)
    expect(yaw).toBeCloseTo(6 + 2000 * DRAG_LOOK_SENSITIVITY)
  })

  it('clamps pitch to +/-PITCH_LIMIT however far the drag goes', () => {
    expect(applyDragLook(0, 0, 0, 100000).pitch).toBe(-PITCH_LIMIT)
    expect(applyDragLook(0, 0, 0, -100000).pitch).toBe(PITCH_LIMIT)
  })

  it('accepts an explicit sensitivity override', () => {
    const { yaw } = applyDragLook(0, 0, 10, 0, 0.01)
    expect(yaw).toBeCloseTo(-0.1)
  })
})
