import { describe, it, expect } from 'vitest'
import { rollModifier, MODIFIERS } from './modifiers.js'

const fixedRng = (v) => () => v

describe('rollModifier', () => {
  it('never rolls a modifier below the minimum level', () => {
    expect(rollModifier(1, fixedRng(0))).toBe(null)
  })

  it('stays clean when the odds roll misses', () => {
    expect(rollModifier(2, fixedRng(0.99))).toBe(null)
  })

  it('picks a modifier from the pool when the odds roll hits', () => {
    // First rng() call is the odds check (must be < chance), second picks
    // the index — fixedRng returns the same value for both, which is fine
    // since 0 < chance and floor(0 * length) is a valid index.
    const m = rollModifier(2, fixedRng(0))
    expect(MODIFIERS).toContain(m)
  })

  it('picks every modifier in the pool across the index range', () => {
    const seen = new Set()
    for (let i = 0; i < MODIFIERS.length; i++) {
      // Second call (the index pick) needs a distinct value per modifier;
      // drive it with a tiny stateful rng that always passes the odds check.
      let call = 0
      const rng = () => (call++ === 0 ? 0 : i / MODIFIERS.length)
      seen.add(rollModifier(2, rng))
    }
    expect(seen).toEqual(new Set(MODIFIERS))
  })
})
