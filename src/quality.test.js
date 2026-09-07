import { describe, it, expect } from 'vitest'
import { qualityFor } from './quality.js'
import { generateTrees, TREE_COUNT } from './trees.js'

// Step 9.5 — the mobile performance tier. The knobs themselves are playtest-
// tuned, so these tests pin the shape, not the exact numbers: desktop is
// unchanged, touch is strictly lighter on every axis, and the thinned tree
// stand stays a prefix of the full scatter so render and colliders can't drift.

describe('qualityFor', () => {
  it('leaves the desktop path at the pre-9.5 scene', () => {
    const d = qualityFor(false)
    expect(d.maxDpr).toBe(2) // @react-three/fiber's own default
    expect(d.shadows).toBe(true)
    expect(d.shadowMapSize).toBe(2048)
    expect(d.treeCount).toBe(TREE_COUNT)
    expect(d.treeShadows).toBe(true)
    expect(d.snowCount).toBe(1500)
  })

  it('drops every budget on a touch device', () => {
    const m = qualityFor(true)
    const d = qualityFor(false)
    expect(m.maxDpr).toBeLessThan(d.maxDpr)
    expect(m.shadowMapSize).toBeLessThan(d.shadowMapSize)
    expect(m.treeCount).toBeLessThan(d.treeCount)
    expect(m.snowCount).toBeLessThan(d.snowCount)
    expect(m.treeShadows).toBe(false)
    expect(m.shadows).not.toBe(true) // a cheaper mode, not off
  })

  it('keeps the thinned tree stand a strict prefix of the full scatter', () => {
    // Same fixed seed + sequential placement => generateTrees(n) is the first
    // n of generateTrees(220). So whatever World.jsx draws on touch is exactly
    // what Player.jsx / Yeti.jsx collide against — no invisible trunks.
    const full = generateTrees(qualityFor(false).treeCount)
    const thin = generateTrees(qualityFor(true).treeCount)

    expect(thin).toHaveLength(qualityFor(true).treeCount)
    thin.forEach((t, i) => {
      expect(t.position).toEqual(full[i].position)
      expect(t.collideR).toEqual(full[i].collideR)
    })
  })
})
