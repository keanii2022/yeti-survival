import { describe, it, expect } from 'vitest'
import { LOG_COUNT, generateLogs, resolveLogCollision } from './logs.js'

// logs.js is the 7.12 collision fallback for a fallen log: a fixed-seed
// scatter of capsules (segment + radius), resolved the same kinematic way as
// trees.js's circles and sheds.js's rectangles.

describe('generateLogs', () => {
  it('places exactly LOG_COUNT logs, identically every call', () => {
    const a = generateLogs()
    const b = generateLogs()
    expect(a).toHaveLength(LOG_COUNT)
    expect(b).toEqual(a)
  })

  it('keeps the spawn circle clear and every log has a real length and collider', () => {
    for (const log of generateLogs()) {
      expect(Math.hypot(log.x, log.z)).toBeGreaterThanOrEqual(10)
      expect(log.halfLength).toBeGreaterThan(0)
      expect(log.collideR).toBeGreaterThan(log.radius)
    }
  })
})

describe('resolveLogCollision', () => {
  // A log centred at the origin, running along its local +Z (yaw 0 -> world
  // +Z), 3 either side, collider radius 0.5.
  const logs = [{ x: 0, z: 0, yaw: 0, halfLength: 3, radius: 0.35, collideR: 0.5 }]
  const out = { x: 0, z: 0 }

  it('leaves a point far from the log untouched', () => {
    resolveLogCollision(logs, 10, 10, 0.4, out)
    expect(out).toEqual({ x: 10, z: 10 })
  })

  it('pushes a body overlapping the middle of the log straight out sideways', () => {
    resolveLogCollision(logs, 0.2, 0, 0.4, out)
    expect(out.x).toBeCloseTo(0.9, 6) // collideR(0.5) + bodyR(0.4)
    expect(out.z).toBeCloseTo(0, 6)
  })

  it('pushes a body overlapping past the log end out from the rounded cap', () => {
    // (0, 3.3) is just past the +Z end (halfLength 3) — nearest point on the
    // segment is the cap at (0, 3), so the push is straight along +Z.
    resolveLogCollision(logs, 0, 3.3, 0.4, out)
    expect(out.x).toBeCloseTo(0, 6)
    expect(out.z).toBeCloseTo(3.9, 6) // 3 + collideR(0.5) + bodyR(0.4)
  })

  it('leaves a body well clear of both the length and the caps untouched', () => {
    resolveLogCollision(logs, 5, 0, 0.4, out)
    expect(out).toEqual({ x: 5, z: 0 })
  })

  it('respects a log rotated off-axis', () => {
    // Same log, yaw = PI/2: its length now runs along world +X instead of +Z.
    const rotated = [{ x: 0, z: 0, yaw: Math.PI / 2, halfLength: 3, radius: 0.35, collideR: 0.5 }]
    resolveLogCollision(rotated, 0, 0.2, 0.4, out)
    expect(out.x).toBeCloseTo(0, 6)
    expect(out.z).toBeCloseTo(0.9, 6)
  })

  it('ignores a body sitting dead-centre rather than dividing by zero', () => {
    resolveLogCollision(logs, 0, 0, 0.4, out)
    expect(Number.isFinite(out.x)).toBe(true)
    expect(Number.isFinite(out.z)).toBe(true)
  })
})
