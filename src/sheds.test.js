import { describe, it, expect } from 'vitest'
import {
  SHED_COUNT,
  SHED_HALF,
  WALL_THICK,
  generateSheds,
  shedApproachPoint,
  nearestReadyShed,
  pointInsideShed,
  resolveShedCollision,
} from './sheds.js'

// sheds.js is the 6.12 shed layer: a fixed-seed scatter of huts plus a pure
// kinematic push-out, same testable split as trees.js. The feel of the radii
// and the check cadence is left to playtesting.

describe('generateSheds', () => {
  it('places exactly SHED_COUNT sheds, identically every call', () => {
    const a = generateSheds()
    const b = generateSheds()
    expect(a).toHaveLength(SHED_COUNT)
    expect(b).toEqual(a)
  })

  it('keeps them inside the arena, off the spawn, and spaced apart', () => {
    const sheds = generateSheds()
    for (const s of sheds) {
      expect(Math.hypot(s.x - 0, s.z - 8)).toBeGreaterThan(15)
      expect(Math.abs(s.x)).toBeLessThan(50)
      expect(Math.abs(s.z)).toBeLessThan(50)
    }
    for (let i = 0; i < sheds.length; i++) {
      for (let j = i + 1; j < sheds.length; j++) {
        expect(
          Math.hypot(sheds[i].x - sheds[j].x, sheds[i].z - sheds[j].z),
        ).toBeGreaterThan(19)
      }
    }
  })
})

describe('shedApproachPoint', () => {
  it('sits out in front of the doorway, clear of the walls', () => {
    const out = { x: 0, z: 0 }
    shedApproachPoint({ x: 0, z: 0, yaw: 0 }, out)
    expect(out.x).toBeCloseTo(0, 6)
    expect(out.z).toBeGreaterThan(SHED_HALF + WALL_THICK + 1)
  })
})

describe('nearestReadyShed', () => {
  const sheds = [
    { x: 0, z: 0, yaw: 0 },
    { x: 30, z: 0, yaw: 0 },
    { x: 60, z: 0, yaw: 0 },
  ]

  it('returns the closest shed that is off cooldown', () => {
    expect(nearestReadyShed(sheds, 28, 0, [0, 0, 0])).toBe(1)
  })

  it('skips a shed still cooling down', () => {
    expect(nearestReadyShed(sheds, 1, 0, [5, 0, 0])).toBe(1)
  })

  it('returns -1 when every shed is on cooldown', () => {
    expect(nearestReadyShed(sheds, 0, 0, [1, 1, 1])).toBe(-1)
  })
})

describe('pointInsideShed', () => {
  it('is true at the centre and false well outside', () => {
    const shed = { x: 0, z: 0, yaw: 0 }
    expect(pointInsideShed(shed, 0, 0)).toBe(true)
    expect(pointInsideShed(shed, 10, 0)).toBe(false)
  })

  it('is false out in the doorway, before you cross the wall line', () => {
    const shed = { x: 0, z: 0, yaw: 0 }
    expect(pointInsideShed(shed, 0, SHED_HALF)).toBe(false)
  })

  it('respects the shed yaw', () => {
    const turned = { x: 5, z: -3, yaw: 1.2 }
    expect(pointInsideShed(turned, 5, -3)).toBe(true)
    expect(pointInsideShed(turned, 5 + SHED_HALF + 2, -3)).toBe(false)
  })
})

describe('resolveShedCollision', () => {
  const sheds = [{ x: 0, z: 0, yaw: 0 }]
  const out = { x: 0, z: 0 }

  it('leaves a point well clear of every shed untouched', () => {
    resolveShedCollision(sheds, 20, 20, 0.4, out)
    expect(out).toEqual({ x: 20, z: 20 })
  })

  it('pushes a body back out of the wall it is lapping', () => {
    // Just past the outer face of the left wall (x = -(SHED_HALF + WALL_THICK)).
    const startX = -(SHED_HALF + WALL_THICK) - 0.2
    resolveShedCollision(sheds, startX, 0, 0.4, out)
    expect(out.x).toBeCloseTo(-(SHED_HALF + WALL_THICK) - 0.4, 5)
    expect(out.z).toBeCloseTo(0, 5)
  })

  it('lets a small body through the doorway gap', () => {
    resolveShedCollision(sheds, 0, SHED_HALF, 0.4, out)
    expect(out.x).toBeCloseTo(0, 3)
    expect(out.z).toBeCloseTo(SHED_HALF, 3)
  })

  it('stops a yeti-sized body from fitting through the doorway', () => {
    resolveShedCollision(sheds, 0, SHED_HALF, 0.9, out)
    // shoved back out along -Z (away from the interior)
    expect(out.z).toBeGreaterThan(SHED_HALF)
  })

  it('leaves a body at the dead centre of a shed alone (touching no wall)', () => {
    const turned = [{ x: 8, z: -2, yaw: Math.PI / 3 }]
    resolveShedCollision(turned, 8, -2, 0.4, out)
    expect(out.x).toBeCloseTo(8, 6)
    expect(out.z).toBeCloseTo(-2, 6)
  })

  it('resolves a rotated shed wall in world space', () => {
    const yaw = Math.PI / 3
    const shed = { x: 8, z: -2, yaw }
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    // Local (-3, 0): just past the outer face of the left wall (x = -2.8).
    const lx = -3
    const lz = 0
    const wx = shed.x + lx * c + lz * s
    const wz = shed.z + -lx * s + lz * c
    const before = Math.hypot(wx - shed.x, wz - shed.z)
    resolveShedCollision([shed], wx, wz, 0.4, out)
    const after = Math.hypot(out.x - shed.x, out.z - shed.z)
    expect(after).toBeGreaterThan(before)
    expect(after).toBeCloseTo(SHED_HALF + WALL_THICK + 0.4, 4)
  })
})
