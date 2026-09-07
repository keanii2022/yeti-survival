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

describe('stepProbe — 7.3 footprint trail', () => {
  it('walks the trail points in order before closing on the target', () => {
    const p = createProbe()
    // Target at (0, 20); trail leads there via (0, 5) then (0, 12).
    beginProbe(p, 0, 20, 5, [
      { x: 0, z: 5 },
      { x: 0, z: 12 },
    ])
    let r = stepProbe(p, { x: 0, z: 0 }, 0.1)
    expect(r.aimX).toBe(0)
    expect(r.aimZ).toBe(5) // heading for the first print, not the target

    r = stepProbe(p, { x: 0, z: 5 }, 0.1) // reached print one
    expect(r.aimZ).toBe(12) // now the second print

    r = stepProbe(p, { x: 0, z: 12 }, 0.1) // reached print two
    expect(r.aimZ).toBe(20) // trail spent — now the real target
    expect(p.phase).toBe('travel')

    stepProbe(p, { x: 0, z: 20 }, 0.1, { rng: fixedRng(0.5) }) // reached target
    expect(p.phase).toBe('look')
  })

  it('does not enter the look phase while still mid-trail on top of the target', () => {
    const p = createProbe()
    // Yeti happens to sit on the target point, but the trail loops out and back.
    beginProbe(p, 0, 0, 5, [{ x: 10, z: 0 }])
    const r = stepProbe(p, { x: 0, z: 0 }, 0.1)
    expect(p.phase).toBe('travel')
    expect(r.aimX).toBe(10) // go walk the print first
  })

  it('beelines the target when no trail is passed (pre-7.3 behaviour)', () => {
    const p = createProbe()
    beginProbe(p, 0, 20, 5)
    const r = stepProbe(p, { x: 0, z: 0 }, 0.1)
    expect(r.aimZ).toBe(20)
  })

  it('treats an empty trail array as no trail', () => {
    const p = createProbe()
    beginProbe(p, 0, 20, 5, [])
    expect(p.trail).toBe(null)
  })

  it('still bails out via the travel timeout while following a trail', () => {
    const p = createProbe()
    beginProbe(p, 0, 999, 999, [{ x: 0, z: 500 }]) // unreachable print + target
    const r = stepProbe(p, { x: 0, z: 0 }, 10, { rng: fixedRng(0.3) }) // blow the 8s travel timeout
    expect(p.phase).toBe('look')
    expect(r.done).toBe(false) // search budget still has plenty left
  })
})

describe('stepProbe — inactive', () => {
  it('reports done for a probe that was never armed', () => {
    const r = stepProbe(createProbe(), { x: 5, z: 5 }, 0.1)
    expect(r.done).toBe(true)
    expect(r.moving).toBe(false)
  })
})
