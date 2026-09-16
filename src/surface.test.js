import { describe, it, expect, afterEach } from 'vitest'
import { surfaceAt, _setSheds, _setPonds } from './surface.js'

// surface.js is the 7.3 hard-ground hook: 'snow' everywhere except inside a
// shed or over pond ice (7.13). Pin one-item lists so a test doesn't ride on
// either fixed-seed scatter.
afterEach(() => {
  _setSheds(null)
  _setPonds(null)
})

describe('surfaceAt', () => {
  it("reads 'snow' out in the open", () => {
    _setSheds([{ x: 0, z: 0, yaw: 0 }])
    _setPonds([])
    expect(surfaceAt(20, -30)).toBe('snow')
  })

  it("reads 'hard' inside a shed's interior box", () => {
    _setSheds([{ x: 5, z: -3, yaw: 1.2 }])
    _setPonds([])
    expect(surfaceAt(5, -3)).toBe('hard')
  })

  it("is still 'snow' in the doorway, before the wall line is crossed", () => {
    _setSheds([{ x: 0, z: 0, yaw: 0 }])
    _setPonds([])
    // 2.5 out along +z is the doorway threshold — pointInsideShed is false here.
    expect(surfaceAt(0, 2.5)).toBe('snow')
  })

  it("reads 'hard' out over pond ice", () => {
    _setSheds([])
    _setPonds([{ x: -10, z: 12, radius: 8 }])
    expect(surfaceAt(-10, 12)).toBe('hard')
  })

  it('falls back to the real shed and pond scatter when neither is pinned', () => {
    // Somewhere out near a corner is open ground on the fixed seed.
    expect(surfaceAt(59, 59)).toBe('snow')
  })
})
