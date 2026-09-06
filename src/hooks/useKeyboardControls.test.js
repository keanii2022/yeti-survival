import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardControls } from './useKeyboardControls.js'

// The hook keeps a plain ref of which movement intents are held — no React
// state, so the render loop can poll it every frame for free. These tests drive
// it with real keyboard events on `window`, the way the browser would.
const press = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const release = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))

describe('useKeyboardControls', () => {
  it('starts with every intent released', () => {
    const { result } = renderHook(() => useKeyboardControls())
    expect(result.current.current).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
    })
  })

  it('tracks a key from press to release', () => {
    const { result } = renderHook(() => useKeyboardControls())

    press('KeyW')
    expect(result.current.current.forward).toBe(true)

    release('KeyW')
    expect(result.current.current.forward).toBe(false)
  })

  it('maps arrow keys and both shift keys to the same intents', () => {
    const { result } = renderHook(() => useKeyboardControls())

    press('ArrowUp')
    press('ShiftRight')
    expect(result.current.current.forward).toBe(true)
    expect(result.current.current.sprint).toBe(true)
  })

  it('ignores keys that are not bound to a movement intent', () => {
    const { result } = renderHook(() => useKeyboardControls())

    expect(() => press('KeyP')).not.toThrow()
    expect(result.current.current).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
    })
  })

  it('clears stuck keys when the window loses focus', () => {
    const { result } = renderHook(() => useKeyboardControls())

    press('KeyD')
    press('ShiftLeft')
    expect(result.current.current.right).toBe(true)

    window.dispatchEvent(new Event('blur'))
    expect(result.current.current.right).toBe(false)
    expect(result.current.current.sprint).toBe(false)
  })

  it('stops listening after unmount', () => {
    const { result, unmount } = renderHook(() => useKeyboardControls())
    const ref = result.current

    unmount()
    press('KeyW')
    expect(ref.current.forward).toBe(false)
  })
})
