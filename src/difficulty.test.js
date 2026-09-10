import { describe, it, expect, beforeEach } from 'vitest'
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  difficultyMods,
  loadDifficulty,
  saveDifficulty,
} from './difficulty.js'

// Easy / Medium / Hard. HARD is the original curve, so its mods have to be exact
// identity — anything else silently re-tunes the playtested game. The numbers
// for easy / medium are playtest territory, so these pin the shape: strictly
// easier on the drain / speed / senses levers, more forgiving on commit time,
// and medium between the two.

describe('difficultyMods', () => {
  it('is exact identity for hard — the untouched original curve', () => {
    expect(difficultyMods('hard')).toEqual({
      warmthDrain: 1,
      yetiSpeed: 1,
      detectRadius: 1,
      commitDelay: 1,
    })
  })

  it('falls back to the identity mods for an unknown / missing difficulty', () => {
    expect(difficultyMods(undefined)).toEqual(difficultyMods('hard'))
    expect(difficultyMods('nightmare')).toEqual(difficultyMods('hard'))
  })

  it('makes medium and easy strictly gentler than hard', () => {
    for (const d of ['medium', 'easy']) {
      const m = difficultyMods(d)
      expect(m.warmthDrain).toBeLessThan(1)
      expect(m.yetiSpeed).toBeLessThan(1)
      expect(m.detectRadius).toBeLessThan(1)
      expect(m.commitDelay).toBeGreaterThan(1) // longer to sit in its sightline
    }
  })

  it('orders easy gentler than medium gentler than hard on every lever', () => {
    const e = difficultyMods('easy')
    const m = difficultyMods('medium')
    expect(e.warmthDrain).toBeLessThan(m.warmthDrain)
    expect(e.yetiSpeed).toBeLessThan(m.yetiSpeed)
    expect(e.detectRadius).toBeLessThan(m.detectRadius)
    expect(e.commitDelay).toBeGreaterThan(m.commitDelay)
  })
})

describe('difficulty preference storage', () => {
  beforeEach(() => {
    try {
      localStorage.clear()
    } catch {
      /* jsdom always has it, but keep the guard honest */
    }
  })

  it('defaults to medium — hard was too punishing out of the box', () => {
    expect(DEFAULT_DIFFICULTY).toBe('medium')
    expect(loadDifficulty()).toBe('medium')
  })

  it('round-trips a valid choice through localStorage', () => {
    saveDifficulty('easy')
    expect(loadDifficulty()).toBe('easy')
    saveDifficulty('hard')
    expect(loadDifficulty()).toBe('hard')
  })

  it('ignores a junk stored value and a junk save', () => {
    localStorage.setItem('yeti:difficulty', 'banana')
    expect(loadDifficulty()).toBe(DEFAULT_DIFFICULTY)
    saveDifficulty('banana')
    expect(loadDifficulty()).toBe(DEFAULT_DIFFICULTY)
  })

  it('exposes the three modes in ascending order', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard'])
  })
})
