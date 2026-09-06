import { useEffect, useRef } from 'react'

// Maps physical key codes (layout-independent) to movement intents.
const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

// Tracks which movement keys are currently held. Returns a ref so the render
// loop can read the latest state every frame without re-rendering React.
export function useKeyboardControls() {
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  })

  useEffect(() => {
    const setKey = (code, value) => {
      const intent = KEY_MAP[code]
      if (intent) keys.current[intent] = value
    }
    const onDown = (e) => setKey(e.code, true)
    const onUp = (e) => setKey(e.code, false)
    // Releasing focus (e.g. Esc out of pointer lock, alt-tab) can swallow the
    // keyup, leaving a key "stuck" — clear everything when the window blurs.
    const onBlur = () => {
      for (const intent of Object.keys(keys.current)) keys.current[intent] = false
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return keys
}
