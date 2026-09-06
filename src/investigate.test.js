import { describe, it, expect } from 'vitest'
import { createProbe, beginProbe, stepProbe } from './investigate.js'

// investigate.js is the yeti's memory: walk to a point, search around it, give
// up. It's pure steering over plain {x,z}, so it's easy to drive frame by frame
// here. A fixed rng keeps the "nearby poke" points deterministic.
const fixedRng = (v) => () => v

describe('beginProbe', () => {
  it('arms the probe in the travel phase aimed at the point', () => {
    const p = createProbe()
    beginProbe(p, 10, -4, 5)
    expect(p.active).toBe(true)
    expect(p.phase).toBe('travel')
    expect(p.targetX).toBe(10)
    expect(p.targetZ).toBe(-4)
    expect(p.searchTimer).toBe(5)
  })
})

describe('stepProbe — travel phase', () => {
  it('steers toward the point at travel speed while far away', () => {
    const p = createProbe()
    beginProbe(p, 20, 0, 5)
    const r = stepProbe(p, { x: 0, z: 0 }, 0.1)
    expect(r.done).toBe(false)
    expect(r.moving).toBe(true)
    expect(r.aimX).toBe(20)
    expect(r.aimZ).toBe(0)
    expect(r.speed).toBeGreaterThan(2)
  })

  it('switches to the look phase once it reaches the point', () => {
    const p = createProbe()
    beginProbe(p, 1, 0, 5)
    stepProbe(p, { x: 0.5, z: 0 }, 0.1, { rng: fixedRng(0.5) })
    expect(p.phase).toBe('look')
  })

  it('does not burn the search budget during travel', () => {
    const p = createProbe()
    beginProbe(p, 100, 0, 5)
    stepProbe(p, { x: 0, z: 0 }, 1)
    expect(p.searchTimer).toBe(5)
  })
})

describe('stepProbe — look phase', () => {
  it('keeps searching near the point until the budget runs out', () => {
    const p = createProbe()
    beginProbe(p, 0, 0, 2)
    const pos = { x: 0, z: 0 }
    let r = stepProbe(p, pos, 0.5, { rng: fixedRng(0.3) }) // arrives, enters look
    expect(r.done).toBe(false)
    r = stepProbe(p, pos, 1.0, { rng: fixedRng(0.3) })
    expect(r.done).toBe(false)
    expect(r.moving).toBe(true)
  })

  it('reports done once the search time elapses', () => {
    const p = createProbe()
    beginProbe(p, 0, 0, 1)
    const pos = { x: 0, z: 0 }
    stepProbe(p, pos, 0.1, { rng: fixedRng(0.3) }) // enter look
    const r = stepProbe(p, pos, 2, { rng: fixedRng(0.3) }) // overrun the budget
    expect(r.done).toBe(true)
    expect(r.moving).toBe(false)
    expect(p.active).toBe(false)
  })

  it('keeps its poke points inside the arena bound', () => {
    const p = createProbe()
    beginProbe(p, 0, 0, 5)
    // rng() -> 0.999 pushes angle and radius to the far edge of SEARCH_RADIUS
    stepProbe(p, { x: 0, z: 0 }, 0.1, { rng: fixedRng(0.999), bound: 3 })
    expect(Math.abs(p.lookX)).toBeLessThanOrEqual(3)
    expect(Math.abs(p.lookZ)).toBeLessThanOrEqual(3)
  })
})

describe('stepProbe — inactive', () => {
  it('reports done for a probe that was never armed', () => {
    const r = stepProbe(createProbe(), { x: 5, z: 5 }, 0.1)
    expect(r.done).toBe(true)
    expect(r.moving).toBe(false)
  })
})
