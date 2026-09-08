import { describe, it, expect } from 'vitest'
import {
  useGame,
  EMBER_SCORE,
  WARMTH_PER_EMBER,
  GREEN_EMBER_SCORE,
  GREEN_ESCAPE_BONUS,
  SNACK_SECONDS,
  BLANKET_SECONDS,
} from './store.js'
import { LEVEL_COUNT, levelTarget } from './levels.js'

// The store is the game's rulebook: warmth, stamina, score, and the two ways a
// run ends. It's plain functions over plain state, so it's the cheapest thing
// to test and the most painful thing to break silently. src/test/setup.js
// resets it to a fresh run before each test.
const get = () => useGame.getState()

describe('collectItem', () => {
  it('adds the score value and counts one more ember', () => {
    get().collectItem(100, 16)
    expect(get().score).toBe(100)
    expect(get().itemsCollected).toBe(1)
  })

  it('tops up warmth by the bonus', () => {
    useGame.setState({ warmth: 50 })
    get().collectItem(100, 16)
    expect(get().warmth).toBe(66)
  })

  it('never lets warmth exceed 100', () => {
    useGame.setState({ warmth: 95 })
    get().collectItem(100, 16) // 95 + 16 would be 111
    expect(get().warmth).toBe(100)
  })

  it('is a no-op once the run is over', () => {
    useGame.setState({ status: 'frozen' })
    get().collectItem(100, 16)
    expect(get().score).toBe(0)
    expect(get().itemsCollected).toBe(0)
  })
})

describe('tickWarmth', () => {
  it('drains warmth by the amount', () => {
    useGame.setState({ warmth: 40 })
    get().tickWarmth(2.5)
    expect(get().warmth).toBe(37.5)
  })

  it('ends the run in "frozen" when warmth runs out', () => {
    useGame.setState({ warmth: 1 })
    get().tickWarmth(2)
    expect(get().warmth).toBe(0)
    expect(get().status).toBe('frozen')
  })

  it('does nothing while paused', () => {
    useGame.setState({ status: 'paused', warmth: 40 })
    get().tickWarmth(10)
    expect(get().warmth).toBe(40)
  })
})

describe('tickTime', () => {
  it('accumulates real seconds onto the run clock', () => {
    get().tickTime(0.5)
    get().tickTime(0.25)
    expect(get().elapsed).toBeCloseTo(0.75)
  })

  it('does nothing once the run is over or paused', () => {
    useGame.setState({ status: 'caught', elapsed: 12 })
    get().tickTime(1)
    expect(get().elapsed).toBe(12)

    useGame.setState({ status: 'paused' })
    get().tickTime(1)
    expect(get().elapsed).toBe(12)
  })
})

describe('scoring constants', () => {
  it('exposes a flat ember score and a warmth top-up well under the old 16', () => {
    expect(EMBER_SCORE).toBe(100)
    expect(WARMTH_PER_EMBER).toBeLessThan(16)
  })

  it('collectItem builds score purely from the ember bonus', () => {
    get().collectItem(EMBER_SCORE, WARMTH_PER_EMBER)
    get().collectItem(EMBER_SCORE, WARMTH_PER_EMBER)
    expect(get().score).toBe(2 * EMBER_SCORE)
    expect(get().itemsCollected).toBe(2)
  })
})

describe('tickStamina', () => {
  it('drains while sprinting and regenerates otherwise', () => {
    useGame.setState({ stamina: 50 })
    get().tickStamina(true, 10)
    expect(get().stamina).toBe(40)
    get().tickStamina(false, 4)
    expect(get().stamina).toBe(44)
  })

  it('clamps between 0 and 100', () => {
    useGame.setState({ stamina: 5 })
    get().tickStamina(true, 999)
    expect(get().stamina).toBe(0)

    useGame.setState({ stamina: 98 })
    get().tickStamina(false, 999)
    expect(get().stamina).toBe(100)
  })

  it('locks sprint when the bar empties', () => {
    useGame.setState({ stamina: 3 })
    get().tickStamina(true, 10)
    expect(get().stamina).toBe(0)
    expect(get().sprintLocked).toBe(true)
  })

  it('keeps sprint locked until stamina climbs back past the unlock threshold', () => {
    useGame.setState({ stamina: 0, sprintLocked: true })

    get().tickStamina(false, 20) // -> 20, still under 30
    expect(get().sprintLocked).toBe(true)

    get().tickStamina(false, 20) // -> 40, over 30
    expect(get().sprintLocked).toBe(false)
  })
})

describe('green ember (6.7)', () => {
  it('exposes bonuses well above a plain ember', () => {
    expect(GREEN_EMBER_SCORE).toBeGreaterThan(EMBER_SCORE)
    expect(GREEN_ESCAPE_BONUS).toBeGreaterThan(0)
  })

  it('collectGreenEmber adds the score and counts one, without touching the wave', () => {
    useGame.setState({ warmth: 50 })
    get().collectGreenEmber()

    expect(get().score).toBe(GREEN_EMBER_SCORE)
    expect(get().greenCount).toBe(1)
    // not part of a level's target, and no warmth lever
    expect(get().itemsCollected).toBe(0)
    expect(get().embersTotal).toBe(0)
    expect(get().warmth).toBe(50)
  })

  it('greenEscape adds the getaway bonus and counts one', () => {
    get().greenEscape()
    expect(get().score).toBe(GREEN_ESCAPE_BONUS)
    expect(get().escapes).toBe(1)
  })

  it('both are no-ops once the run is over', () => {
    useGame.setState({ status: 'caught' })
    get().collectGreenEmber()
    get().greenEscape()
    expect(get().score).toBe(0)
    expect(get().greenCount).toBe(0)
    expect(get().escapes).toBe(0)
  })
})

describe('inventory (7.4)', () => {
  it('exposes short, positive effect windows', () => {
    expect(SNACK_SECONDS).toBeGreaterThan(0)
    expect(SNACK_SECONDS).toBeLessThan(20)
    expect(BLANKET_SECONDS).toBeGreaterThan(0)
    expect(BLANKET_SECONDS).toBeLessThan(20)
  })

  it('starts with four empty slots and the selection at 0', () => {
    expect(get().slots).toEqual([null, null, null, null])
    expect(get().selectedSlot).toBe(0)
  })

  it('grabItem fills the first free slot, and stacks duplicates', () => {
    get().grabItem('snack')
    get().grabItem('blanket')
    get().grabItem('snack')
    expect(get().slots).toEqual(['snack', 'blanket', 'snack', null])
  })

  it('grabItem points the selection at the first item, then leaves it alone', () => {
    get().grabItem('blanket')
    expect(get().selectedSlot).toBe(0) // was pointing at nothing -> snaps to it

    useGame.setState({ selectedSlot: 0 })
    get().grabItem('snack') // slot 0 still holds the blanket -> selection stays
    expect(get().selectedSlot).toBe(0)
  })

  it('cycleSlot walks the selection through the filled slots, wrapping', () => {
    useGame.setState({ slots: ['snack', null, 'blanket', 'decoy'], selectedSlot: 0 })
    get().cycleSlot()
    expect(get().selectedSlot).toBe(2)
    get().cycleSlot()
    expect(get().selectedSlot).toBe(3)
    get().cycleSlot()
    expect(get().selectedSlot).toBe(0)
  })

  it('cycleSlot is a no-op with fewer than two items, or a paused/over run', () => {
    useGame.setState({ slots: ['snack', null, null, null], selectedSlot: 0 })
    get().cycleSlot()
    expect(get().selectedSlot).toBe(0)

    useGame.setState({ slots: ['snack', 'blanket', null, null], status: 'caught' })
    get().cycleSlot()
    expect(get().selectedSlot).toBe(0)
  })

  it('grabItem is a no-op when the inventory is full', () => {
    useGame.setState({ slots: ['snack', 'blanket', 'decoy', 'snack'] })
    get().grabItem('blanket')
    expect(get().slots).toEqual(['snack', 'blanket', 'decoy', 'snack'])
  })

  it('grabItem is a no-op once the run is over', () => {
    useGame.setState({ status: 'frozen' })
    get().grabItem('snack')
    expect(get().slots).toEqual([null, null, null, null])
  })

  it('dropSlot empties one slot and flags the drop for Drops.jsx', () => {
    useGame.setState({ slots: ['snack', 'blanket', null, null], selectedSlot: 0 })
    const before = get().dropReq
    get().dropSlot(0)
    expect(get().slots).toEqual([null, 'blanket', null, null])
    expect(get().selectedSlot).toBe(1) // selection falls to what's still carried
    expect(get().pendingDrop).toBe('snack')
    expect(get().dropReq).toBe(before + 1)
  })

  it('dropSlot is a no-op on an empty slot, an interlude, or a finished run', () => {
    useGame.setState({ slots: ['snack', null, null, null] })
    get().dropSlot(1)
    expect(get().slots).toEqual(['snack', null, null, null])
    expect(get().dropReq).toBe(0)

    useGame.setState({ interlude: true })
    get().dropSlot(0)
    expect(get().slots).toEqual(['snack', null, null, null])

    useGame.setState({ interlude: false, status: 'caught' })
    get().dropSlot(0)
    expect(get().slots).toEqual(['snack', null, null, null])
    expect(get().dropReq).toBe(0)
  })

  it('useSlot on a snack spends it, pins stamina full, and clears the sprint lock', () => {
    useGame.setState({ slots: [null, 'snack', null, null], stamina: 10, sprintLocked: true })
    get().useSlot(1)

    expect(get().slots).toEqual([null, null, null, null])
    expect(get().snackActive).toBe(true)
    expect(get().stamina).toBe(100)
    expect(get().sprintLocked).toBe(false)
  })

  it('useSlot on a blanket spends it and arms the slower-drain flag', () => {
    useGame.setState({ slots: ['blanket', null, null, null] })
    get().useSlot(0)

    expect(get().slots).toEqual([null, null, null, null])
    expect(get().blanketActive).toBe(true)

    get().endBlanket()
    expect(get().blanketActive).toBe(false)
  })

  it('useSlot on a decoy clears the slot and bumps throwReq for Decoy.jsx', () => {
    useGame.setState({ slots: [null, null, 'decoy', null] })
    const before = get().throwReq
    get().useSlot(2)

    expect(get().slots).toEqual([null, null, null, null])
    expect(get().throwReq).toBe(before + 1)
  })

  it('useSlot drops the selection onto whatever is still carried', () => {
    useGame.setState({ slots: ['snack', 'blanket', null, null], selectedSlot: 0 })
    get().useSlot(0)
    expect(get().slots).toEqual([null, 'blanket', null, null])
    expect(get().selectedSlot).toBe(1)
  })

  it('useSlot is a no-op on an empty slot, an interlude, or a finished run', () => {
    get().useSlot(0) // empty
    expect(get().snackActive).toBe(false)

    useGame.setState({ slots: ['snack', null, null, null], interlude: true })
    get().useSlot(0)
    expect(get().snackActive).toBe(false)
    expect(get().slots).toEqual(['snack', null, null, null])

    useGame.setState({ interlude: false, status: 'caught' })
    get().useSlot(0)
    expect(get().slots).toEqual(['snack', null, null, null])
  })

  it('tickStamina holds the bar at full while a snack is active, whatever the drain', () => {
    useGame.setState({ snackActive: true, stamina: 100 })
    get().tickStamina(true, 999) // a full frame of "sprinting"
    expect(get().stamina).toBe(100)
    expect(get().sprintLocked).toBe(false)
  })

  it('endSnack lifts the effect so normal stamina drain resumes', () => {
    useGame.setState({ snackActive: true })
    get().endSnack()
    expect(get().snackActive).toBe(false)

    useGame.setState({ stamina: 50 })
    get().tickStamina(true, 10)
    expect(get().stamina).toBe(40)
  })

  it('reset clears the slots, the selection, and both effect flags', () => {
    useGame.setState({
      slots: ['snack', 'blanket', 'decoy', 'snack'],
      selectedSlot: 2,
      snackActive: true,
      blanketActive: true,
    })
    get().reset()
    expect(get()).toMatchObject({
      slots: [null, null, null, null],
      selectedSlot: 0,
      snackActive: false,
      blanketActive: false,
    })
  })
})

describe('run status transitions', () => {
  it('pause only works from "playing", resume only from "paused"', () => {
    get().pause()
    expect(get().status).toBe('paused')

    get().pause() // already paused
    expect(get().status).toBe('paused')

    get().resume()
    expect(get().status).toBe('playing')
  })

  it('catchPlayer ends the run, and only from "playing"', () => {
    get().catchPlayer()
    expect(get().status).toBe('caught')

    useGame.setState({ status: 'frozen' })
    get().catchPlayer() // must not overwrite a finished run
    expect(get().status).toBe('frozen')
  })
})

describe('reset', () => {
  it('restores a fresh run and bumps runId so the scene remounts', () => {
    useGame.setState({
      status: 'caught',
      score: 700,
      itemsCollected: 5,
      itemsTotal: 8,
      embersTotal: 40,
      greenCount: 3,
      escapes: 2,
      level: 4,
      interlude: true,
      nightfall: true,
      elapsed: 182.5,
      warmth: 3,
      stamina: 0,
      sprintLocked: true,
      slots: ['snack', 'blanket', 'decoy', 'snack'],
      selectedSlot: 3,
      snackActive: true,
      blanketActive: true,
    })
    const before = get().runId

    get().reset()

    expect(get()).toMatchObject({
      status: 'playing',
      score: 0,
      itemsCollected: 0,
      itemsTotal: levelTarget(1),
      embersTotal: 0,
      greenCount: 0,
      escapes: 0,
      level: 1,
      interlude: false,
      nightfall: false,
      elapsed: 0,
      warmth: 100,
      stamina: 100,
      sprintLocked: false,
      slots: [null, null, null, null],
      selectedSlot: 0,
      snackActive: false,
      blanketActive: false,
      runId: before + 1,
    })
  })
})

describe('levels (6.6)', () => {
  it('reports level 1 and its ember target on a fresh run', () => {
    expect(get().level).toBe(1)
    expect(get().itemsTotal).toBe(levelTarget(1))
  })

  it('opens the interlude once the level target is cleared', () => {
    useGame.setState({ itemsCollected: levelTarget(1) - 1 })
    get().collectItem(EMBER_SCORE, WARMTH_PER_EMBER)

    expect(get().interlude).toBe(true)
    expect(get().level).toBe(1) // not advanced yet — endInterlude does that
    expect(get().status).toBe('playing')
  })

  it('endInterlude advances the level, resets the per-level count, sets the new target', () => {
    useGame.setState({ interlude: true, level: 2, itemsCollected: 6, itemsTotal: 6 })
    get().endInterlude()

    expect(get().interlude).toBe(false)
    expect(get().level).toBe(3)
    expect(get().itemsCollected).toBe(0)
    expect(get().itemsTotal).toBe(levelTarget(3))
  })

  it('keeps embersTotal and score climbing across a level boundary', () => {
    useGame.setState({ itemsCollected: levelTarget(1) - 1, embersTotal: 5, score: 500 })
    get().collectItem(EMBER_SCORE, WARMTH_PER_EMBER)
    expect(get().embersTotal).toBe(6)
    expect(get().score).toBe(600)
  })

  it('clearing the last level wins the run instead of opening an interlude', () => {
    useGame.setState({
      level: LEVEL_COUNT,
      itemsCollected: levelTarget(LEVEL_COUNT) - 1,
      itemsTotal: levelTarget(LEVEL_COUNT),
    })
    get().collectItem(EMBER_SCORE, WARMTH_PER_EMBER)

    expect(get().status).toBe('won')
    expect(get().interlude).toBe(false)
  })

  it('nightfall runs the same climb structure — interlude on early levels, win on the last', () => {
    useGame.setState({
      nightfall: true,
      level: 3,
      itemsCollected: levelTarget(3) - 1,
      itemsTotal: levelTarget(3),
    })
    get().collectItem(EMBER_SCORE, WARMTH_PER_EMBER)
    expect(get().interlude).toBe(true)
    expect(get().status).toBe('playing')

    useGame.setState({
      interlude: false,
      level: LEVEL_COUNT,
      itemsCollected: levelTarget(LEVEL_COUNT) - 1,
      itemsTotal: levelTarget(LEVEL_COUNT),
    })
    get().collectItem(EMBER_SCORE, WARMTH_PER_EMBER)
    expect(get().status).toBe('won')
  })

  it('startNightfall only fires from a non-nightfall win and carries score forward', () => {
    useGame.setState({ status: 'caught', score: 900 })
    get().startNightfall()
    expect(get().status).toBe('caught') // no-op — not a win

    useGame.setState({
      status: 'won',
      level: LEVEL_COUNT,
      score: 900,
      warmth: 4,
      embersTotal: 60,
      slots: ['snack', 'decoy', null, null],
      selectedSlot: 1,
      blanketActive: true,
    })
    const before = get().runId
    get().startNightfall()

    expect(get()).toMatchObject({
      status: 'playing',
      nightfall: true,
      level: 1,
      itemsTotal: levelTarget(1),
      itemsCollected: 0,
      score: 900,
      embersTotal: 60,
      warmth: 100,
      slots: [null, null, null, null],
      selectedSlot: 0,
      blanketActive: false,
      runId: before + 1,
    })
  })
})
