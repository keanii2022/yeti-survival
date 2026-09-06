import { describe, it, expect } from 'vitest'
import { useGame, ITEM_TOTAL } from './store.js'

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
      warmth: 3,
      stamina: 0,
      sprintLocked: true,
    })
    const before = get().runId

    get().reset()

    expect(get()).toMatchObject({
      status: 'playing',
      score: 0,
      itemsCollected: 0,
      warmth: 100,
      stamina: 100,
      sprintLocked: false,
      runId: before + 1,
    })
  })
})

describe('ITEM_TOTAL', () => {
  it('is the single source of truth the store reports as itemsTotal', () => {
    expect(get().itemsTotal).toBe(ITEM_TOTAL)
  })
})
