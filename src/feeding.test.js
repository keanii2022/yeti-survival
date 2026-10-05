import { describe, it, expect } from 'vitest'
import {
  createFeed,
  beginFeed,
  stepFeed,
  rollFeed,
  feedDelay,
  FEED_DELAY_MIN,
  FEED_DELAY_VAR,
} from './feeding.js'

const fixedRng = (v) => () => v

describe('beginFeed', () => {
  it('arms the feed in the travel phase aimed at the ember', () => {
    const f = createFeed()
    beginFeed(f, 10, -4)
    expect(f.active).toBe(true)
    expect(f.phase).toBe('travel')
    expect(f.x).toBe(10)
    expect(f.z).toBe(-4)
  })
})

describe('stepFeed — travel phase', () => {
  it('steers toward the ember while still far away', () => {
    const f = createFeed()
    beginFeed(f, 20, 0)
    const r = stepFeed(f, { x: 0, z: 0 }, 0.1)
    expect(r.done).toBe(false)
    expect(r.moving).toBe(true)
    expect(r.aimX).toBe(20)
    expect(r.aimZ).toBe(0)
  })

  it('switches to the eat phase on arrival and stands still', () => {
    const f = createFeed()
    beginFeed(f, 1, 0)
    const r = stepFeed(f, { x: 0.5, z: 0 }, 0.1)
    expect(f.phase).toBe('eat')
    expect(r.done).toBe(false)
    expect(r.moving).toBe(false)
  })
})

describe('stepFeed — eat phase', () => {
  it('stays stationary and not done until the duration elapses', () => {
    const f = createFeed()
    beginFeed(f, 0, 0)
    const pos = { x: 0, z: 0 }
    let r = stepFeed(f, pos, 0.1) // arrives, enters eat
    expect(r.done).toBe(false)
    r = stepFeed(f, pos, 1)
    expect(r.done).toBe(false)
    expect(r.moving).toBe(false)
  })

  it('reports done once the feed duration runs out', () => {
    const f = createFeed()
    beginFeed(f, 0, 0)
    const pos = { x: 0, z: 0 }
    stepFeed(f, pos, 0.1) // enter eat
    const r = stepFeed(f, pos, 30) // blow the whole duration
    expect(r.done).toBe(true)
    expect(r.moving).toBe(false)
    expect(f.active).toBe(false)
  })
})

describe('stepFeed — inactive', () => {
  it('reports done for a feed that was never armed', () => {
    const r = stepFeed(createFeed(), { x: 5, z: 5 }, 0.1)
    expect(r.done).toBe(true)
    expect(r.moving).toBe(false)
  })
})

describe('feedDelay', () => {
  it('lands a few seconds into the level, inside the rolled window', () => {
    expect(feedDelay(fixedRng(0))).toBe(FEED_DELAY_MIN)
    expect(feedDelay(fixedRng(0.999))).toBeLessThan(FEED_DELAY_MIN + FEED_DELAY_VAR)
  })
})

describe('rollFeed', () => {
  const liveField = { level: 3, remaining: 7, nearX: 1, nearZ: 2 }

  it('stays pending while the field is for a different level', () => {
    const field = { ...liveField, level: 2 }
    expect(rollFeed(3, field, 0, fixedRng(0))).toBe('pending')
  })

  it('stays pending while the level\'s feed delay is still running', () => {
    expect(rollFeed(3, liveField, 2, fixedRng(0))).toBe('pending')
  })

  it('stays pending once the wave is fully cleared', () => {
    const field = { ...liveField, remaining: 0 }
    expect(rollFeed(3, field, 0, fixedRng(0))).toBe('pending')
  })

  it('rolls early in the level — a full wave still out is fine', () => {
    expect(rollFeed(3, liveField, 0, fixedRng(0))).toBe('feed')
  })

  it('resolves to skip when the roll misses', () => {
    expect(rollFeed(3, liveField, 0, fixedRng(0.999))).toBe('skip')
  })
})
