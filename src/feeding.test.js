import { describe, it, expect } from 'vitest'
import { createFeed, beginFeed, stepFeed, rollFeed, FEED_CLUSTER_SIZE } from './feeding.js'

const fixedRng = (v) => () => v

describe('beginFeed', () => {
  it('arms the feed in the travel phase aimed at the cluster', () => {
    const f = createFeed()
    beginFeed(f, 10, -4)
    expect(f.active).toBe(true)
    expect(f.phase).toBe('travel')
    expect(f.x).toBe(10)
    expect(f.z).toBe(-4)
  })
})

describe('stepFeed — travel phase', () => {
  it('steers toward the cluster while still far away', () => {
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

describe('rollFeed', () => {
  const eligibleField = { level: 3, remaining: FEED_CLUSTER_SIZE, clusterX: 1, clusterZ: 2 }

  it('stays pending while the field is for a different level', () => {
    const field = { ...eligibleField, level: 2 }
    expect(rollFeed(3, field, fixedRng(0))).toBe('pending')
  })

  it('stays pending while more than the cluster size remains', () => {
    const field = { ...eligibleField, remaining: FEED_CLUSTER_SIZE + 1 }
    expect(rollFeed(3, field, fixedRng(0))).toBe('pending')
  })

  it('stays pending once the wave is fully cleared', () => {
    const field = { ...eligibleField, remaining: 0 }
    expect(rollFeed(3, field, fixedRng(0))).toBe('pending')
  })

  it('resolves to feed when the roll beats the odds', () => {
    expect(rollFeed(3, eligibleField, fixedRng(0))).toBe('feed')
  })

  it('resolves to skip when the roll misses', () => {
    expect(rollFeed(3, eligibleField, fixedRng(0.999))).toBe('skip')
  })
})
