import { describe, it, expect, afterEach } from 'vitest'
import { surfaceAt, _setSheds } from './surface.js'

// surface.js is the 7.3 hard-ground hook: 'snow' everywhere except inside a
// shed. Pin a one-shed list so the test doesn't ride on the fixed-seed scatter.
afterEach(() => _setSheds(null))

describe('surfaceAt', () => {
  it("reads 'snow' out in the open", () => {
    _setSheds([{ x: 0, z: 0, yaw: 0 }])
    expect(surfaceAt(20, -30)).toBe('snow')
  })

  it("reads 'hard' inside a shed's interior box", () => {
    _setSheds([{ x: 5, z: -3, yaw: 1.2 }])
    expect(surfaceAt(5, -3)).toBe('hard')
  })

  it("is still 'snow' in the doorway, before the wall line is crossed", () => {
    _setSheds([{ x: 0, z: 0, yaw: 0 }])
    // 2.5 out along +z is the doorway threshold — pointInsideShed is false here.
    expect(surfaceAt(0, 2.5)).toBe('snow')
  })

  it('falls back to the real shed scatter when none is pinned', () => {
    // Somewhere out near a corner is open ground on the fixed seed.
    expect(surfaceAt(55, 55)).toBe('snow')
  })
})
