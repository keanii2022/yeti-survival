import { describe, it, expect, vi } from 'vitest'
import { isPortrait, requestFullscreen } from './orientation.js'

// 9.6's pure bits: portrait detection (media query first, size compare as the
// fallback) and the defensive fullscreen wrapper. OrientationNudge.jsx owns the
// listeners; App.jsx owns the gesture handler that calls requestFullscreen.

describe('isPortrait', () => {
  const win = (opts) => ({
    matchMedia:
      opts.matches === undefined
        ? undefined
        : () => ({ matches: opts.matches }),
    innerWidth: opts.w,
    innerHeight: opts.h,
  })

  it('reads the (orientation: portrait) media query when present', () => {
    expect(isPortrait(win({ matches: true, w: 900, h: 400 }))).toBe(true)
    expect(isPortrait(win({ matches: false, w: 400, h: 900 }))).toBe(false)
  })

  it('falls back to comparing innerHeight and innerWidth', () => {
    expect(isPortrait(win({ w: 400, h: 900 }))).toBe(true)
    expect(isPortrait(win({ w: 900, h: 400 }))).toBe(false)
  })

  it('falls back to the size compare when matchMedia throws', () => {
    const w = {
      matchMedia: () => {
        throw new Error('bad query')
      },
      innerWidth: 400,
      innerHeight: 900,
    }
    expect(isPortrait(w)).toBe(true)
  })

  it('is false when there is no window', () => {
    expect(isPortrait(undefined)).toBe(false)
  })
})

describe('requestFullscreen', () => {
  it('calls the standard requestFullscreen on the element', () => {
    const el = { requestFullscreen: vi.fn(() => Promise.resolve()) }
    requestFullscreen(el)
    expect(el.requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('falls back to the webkit-prefixed method', () => {
    const el = { webkitRequestFullscreen: vi.fn() }
    requestFullscreen(el)
    expect(el.webkitRequestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('swallows a rejected promise (iOS Safari has no Fullscreen API)', () => {
    const el = { requestFullscreen: () => Promise.reject(new Error('denied')) }
    expect(() => requestFullscreen(el)).not.toThrow()
  })

  it('swallows a synchronous throw', () => {
    const el = {
      requestFullscreen: () => {
        throw new Error('denied')
      },
    }
    expect(() => requestFullscreen(el)).not.toThrow()
  })

  it('is a no-op when no fullscreen method exists', () => {
    expect(() => requestFullscreen({})).not.toThrow()
    expect(() => requestFullscreen(undefined)).not.toThrow()
  })
})
