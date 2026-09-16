import { describe, it, expect, beforeEach } from 'vitest'
import { flare, resetFlare, resolveFlareCollision, FLARE_RADIUS } from './flare.js'

// flare.js is the 7.9 area-denial collider — a single dynamic circle pushed
// out the same way trees.js pushes a fixed one, gated on `flare.live`.

describe('resolveFlareCollision', () => {
  const out = { x: 0, z: 0 }

  beforeEach(() => {
    resetFlare()
  })

  it('is a no-op while unlit', () => {
    flare.x = 0
    flare.z = 0
    flare.live = false
    resolveFlareCollision(1, 1, 0.9, out)
    expect(out).toEqual({ x: 1, z: 1 })
  })

  it('leaves a point outside the lit radius untouched', () => {
    flare.x = 0
    flare.z = 0
    flare.live = true
    resolveFlareCollision(FLARE_RADIUS + 5, 0, 0.9, out)
    expect(out).toEqual({ x: FLARE_RADIUS + 5, z: 0 })
  })

  it('pushes an overlapping body out to exactly radius + body radius', () => {
    flare.x = 0
    flare.z = 0
    flare.live = true
    resolveFlareCollision(1, 0, 0.9, out)
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(FLARE_RADIUS + 0.9, 6)
    expect(out.x).toBeGreaterThan(0)
    expect(out.z).toBeCloseTo(0, 6)
  })

  it('ignores a body sitting dead-centre rather than dividing by zero', () => {
    flare.x = 5
    flare.z = -5
    flare.live = true
    resolveFlareCollision(5, -5, 0.9, out)
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
  })
})
