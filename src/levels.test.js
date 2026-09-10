import { describe, it, expect } from 'vitest'
import {
  LEVEL_COUNT,
  NIGHTFALL_OFFSET,
  levelTarget,
  levelParams,
  effectiveLevel,
} from './levels.js'

// levels.js is the 6.6 escalation curve — pure arithmetic, so it's cheap to pin
// down the shape (monotonic, clamped below sprint) and the level-1 values that
// have to keep matching the 6.1 / 6.11 feel.

// Player reference speeds from Player.jsx.
const WALK = 6
const SPRINT = 10

describe('levelTarget', () => {
  it('is 7 through L3, then 8', () => {
    expect([1, 2, 3].map(levelTarget)).toEqual([7, 7, 7])
    expect([4, 5, 6].map(levelTarget)).toEqual([8, 8, 8])
  })

  it('caps at 8 for any deeper / nightfall level', () => {
    expect([7, 8, 9, 10].map(levelTarget)).toEqual([8, 8, 8, 8])
    expect(levelTarget(25)).toBe(8)
  })
})

describe('levelParams — level 1 keeps the pre-6.6 feel', () => {
  const p = levelParams(1)

  it('sits just under the 6.1 chase speed and matches its burst', () => {
    expect(p.chaseSpeed).toBeCloseTo(5.2)
    expect(p.burstSpeed).toBeCloseTo(7)
  })

  it('matches the 6.11 detection / lose / reacquire rings', () => {
    expect(p.detectRadius).toBeCloseTo(18)
    expect(p.loseRadius).toBeCloseTo(24)
    expect(p.reacquireRadius).toBeCloseTo(14)
  })

  it('starts the search window at the 6.11 baseline', () => {
    expect(p.searchTime).toBeCloseTo(4)
  })

  it('roams the whole arena at level 1 (wander leash wide open)', () => {
    expect(p.wanderRadius).toBeGreaterThanOrEqual(120)
  })
})

describe('levelParams — the curve', () => {
  const levels = Array.from({ length: 30 }, (_, i) => i + 1)

  it('never lets the sustained chase reach sprint speed', () => {
    for (const L of levels) expect(levelParams(L).chaseSpeed).toBeLessThan(SPRINT)
  })

  it('keeps the burst above the sustained speed but still under sprint', () => {
    for (const L of levels) {
      const p = levelParams(L)
      expect(p.burstSpeed).toBeGreaterThan(p.chaseSpeed)
      expect(p.burstSpeed).toBeLessThan(SPRINT)
    }
  })

  it('has the pre-L5 chase sitting between a walk and a sprint', () => {
    for (const L of [1, 2, 3, 4]) {
      const s = levelParams(L).chaseSpeed
      expect(s).toBeGreaterThanOrEqual(WALK - 1)
      expect(s).toBeLessThan(SPRINT)
    }
    // by L5 it's within a stride of sprint — you can't just run any more
    expect(levelParams(5).chaseSpeed).toBeGreaterThan(WALK + 2)
  })

  it('grows chase speed and detection radius monotonically', () => {
    for (let L = 2; L <= 30; L++) {
      expect(levelParams(L).chaseSpeed).toBeGreaterThanOrEqual(
        levelParams(L - 1).chaseSpeed,
      )
      expect(levelParams(L).detectRadius).toBeGreaterThan(
        levelParams(L - 1).detectRadius,
      )
    }
  })

  it('keeps the 6u lose-radius hysteresis and inside-detection reacquire at every level', () => {
    for (const L of levels) {
      const p = levelParams(L)
      expect(p.loseRadius - p.detectRadius).toBeCloseTo(6)
      expect(p.detectRadius - p.reacquireRadius).toBeCloseTo(4)
    }
  })

  it('shrinks the commit delay to an instant lock by the deep levels, never negative', () => {
    expect(levelParams(1).commitDelay).toBeGreaterThan(0.5)
    expect(levelParams(9).commitDelay).toBe(0)
    for (const L of levels) expect(levelParams(L).commitDelay).toBeGreaterThanOrEqual(0)
  })

  it('lengthens the search window but clamps it so it can’t outlast the warmth clock', () => {
    expect(levelParams(6).searchTime).toBeGreaterThan(levelParams(2).searchTime)
    for (const L of levels) expect(levelParams(L).searchTime).toBeLessThanOrEqual(11)
  })

  it('tightens the wander leash with depth, with a floor so he still moves', () => {
    expect(levelParams(10).wanderRadius).toBeLessThan(levelParams(2).wanderRadius)
    for (const L of levels) expect(levelParams(L).wanderRadius).toBeGreaterThanOrEqual(26)
  })

  it('checks sheds slowly at L1 and much more often deep in (6.12)', () => {
    expect(levelParams(1).shedCheckInterval).toBeGreaterThan(
      levelParams(8).shedCheckInterval,
    )
    expect(levelParams(1).shedLookTime).toBeLessThan(levelParams(8).shedLookTime)
  })

  it('never checks faster than every 10s or lingers past 4s, and both move monotonically', () => {
    for (const L of levels) {
      expect(levelParams(L).shedCheckInterval).toBeGreaterThanOrEqual(10)
      expect(levelParams(L).shedLookTime).toBeLessThanOrEqual(4)
    }
    for (let L = 2; L <= 30; L++) {
      expect(levelParams(L).shedCheckInterval).toBeLessThanOrEqual(
        levelParams(L - 1).shedCheckInterval,
      )
      expect(levelParams(L).shedLookTime).toBeGreaterThanOrEqual(
        levelParams(L - 1).shedLookTime,
      )
    }
  })
})

describe('levelParams — difficulty', () => {
  const levels = Array.from({ length: 12 }, (_, i) => i + 1)

  it('a bare call and an explicit "hard" call are the same raw curve', () => {
    for (const L of levels) {
      expect(levelParams(L, 'hard')).toEqual(levelParams(L))
    }
  })

  it('easy / medium slow the chase, the burst and the detection ring', () => {
    for (const L of levels) {
      const hard = levelParams(L)
      for (const d of ['medium', 'easy']) {
        const p = levelParams(L, d)
        expect(p.chaseSpeed).toBeLessThan(hard.chaseSpeed)
        expect(p.burstSpeed).toBeLessThan(hard.burstSpeed)
        expect(p.detectRadius).toBeLessThan(hard.detectRadius)
        expect(p.commitDelay).toBeGreaterThanOrEqual(hard.commitDelay)
      }
      // easy is gentler than medium
      expect(levelParams(L, 'easy').chaseSpeed).toBeLessThan(
        levelParams(L, 'medium').chaseSpeed,
      )
      expect(levelParams(L, 'easy').detectRadius).toBeLessThan(
        levelParams(L, 'medium').detectRadius,
      )
    }
  })

  it('keeps the burst above the sustained speed at every difficulty', () => {
    for (const L of levels) {
      for (const d of ['easy', 'medium', 'hard']) {
        const p = levelParams(L, d)
        expect(p.burstSpeed).toBeGreaterThan(p.chaseSpeed)
      }
    }
  })

  it('keeps the lose / reacquire hysteresis (6u / 4u) after the ring is scaled', () => {
    for (const L of levels) {
      for (const d of ['easy', 'medium', 'hard']) {
        const p = levelParams(L, d)
        expect(p.loseRadius - p.detectRadius).toBeCloseTo(6)
        expect(p.detectRadius - p.reacquireRadius).toBeCloseTo(4)
      }
    }
  })

  it('still grows chase speed and detection monotonically within easy / medium', () => {
    for (const d of ['easy', 'medium']) {
      for (let L = 2; L <= 12; L++) {
        expect(levelParams(L, d).chaseSpeed).toBeGreaterThanOrEqual(
          levelParams(L - 1, d).chaseSpeed,
        )
        expect(levelParams(L, d).detectRadius).toBeGreaterThan(
          levelParams(L - 1, d).detectRadius,
        )
      }
    }
  })

  it('never lets even the hard-mode deep chase reach sprint speed', () => {
    for (let L = 1; L <= 30; L++) {
      expect(levelParams(L, 'hard').chaseSpeed).toBeLessThan(SPRINT)
      expect(levelParams(L, 'hard').burstSpeed).toBeLessThan(SPRINT)
    }
  })
})

describe('LEVEL_COUNT', () => {
  it('is the tuned climb length (playtest: 10 → 6 → 8 → 6, a run that can be finished)', () => {
    expect(LEVEL_COUNT).toBe(6)
  })
})

describe('effectiveLevel (nightfall)', () => {
  it('is a no-op in a normal run', () => {
    for (const L of [1, 5, 10]) expect(effectiveLevel(L, false)).toBe(L)
  })

  it('shifts every nightfall level up by NIGHTFALL_OFFSET', () => {
    expect(effectiveLevel(1, true)).toBe(1 + NIGHTFALL_OFFSET)
    expect(effectiveLevel(2, true)).toBe(2 + NIGHTFALL_OFFSET)
  })

  it('never lets nightfall climb past level 10 — the hardest already beaten', () => {
    for (let L = 1; L <= LEVEL_COUNT; L++) {
      expect(effectiveLevel(L, true)).toBeLessThanOrEqual(LEVEL_COUNT)
    }
    expect(effectiveLevel(LEVEL_COUNT, true)).toBe(LEVEL_COUNT)
  })

  it('starts nightfall at a real mid-curve difficulty, not level 1 again', () => {
    expect(levelParams(effectiveLevel(1, true)).chaseSpeed).toBeGreaterThan(
      levelParams(1).chaseSpeed + 2,
    )
  })
})
