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
}

// The forward keys, and the modifiers that still alias sprint.
const FORWARD_CODES = new Set(['KeyW', 'ArrowUp'])
const SHIFT_CODES = new Set(['ShiftLeft', 'ShiftRight'])

// Step 7.4: sprint moved off the pinky. Double-tap a forward key inside this
// window and then keep it held to sprint — release forward to drop back to a
// walk. Shift is kept as a hold-to-sprint alias for now. Tuned so a deliberate
// tap-tap latches but a single firm press never does.
export const DOUBLE_TAP_MS = 280

// Tracks which movement keys are currently held, plus the derived `sprint`
// intent. Returns a ref so the render loop can read the latest state every
// frame without re-rendering React.
export function useKeyboardControls() {
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  })

  useEffect(() => {
    // Internal sprint inputs, folded into keys.current.sprint by refreshSprint.
    const shiftHeld = { current: false }
    const doubleTapped = { current: false } // forward key double-tapped and still down
    let lastForwardDown = -Infinity

    const refreshSprint = () => {
      keys.current.sprint =
        shiftHeld.current || (doubleTapped.current && keys.current.forward)
    }

    const onDown = (e) => {
      if (SHIFT_CODES.has(e.code)) {
        shiftHeld.current = true
        refreshSprint()
        return
      }
      if (FORWARD_CODES.has(e.code) && !e.repeat) {
        const now = performance.now()
        if (now - lastForwardDown <= DOUBLE_TAP_MS) doubleTapped.current = true
        lastForwardDown = now
      }
      const intent = KEY_MAP[e.code]
      if (intent) keys.current[intent] = true
      refreshSprint()
    }
    const onUp = (e) => {
      if (SHIFT_CODES.has(e.code)) {
        shiftHeld.current = false
        refreshSprint()
        return
      }
      if (FORWARD_CODES.has(e.code)) doubleTapped.current = false
      const intent = KEY_MAP[e.code]
      if (intent) keys.current[intent] = false
      refreshSprint()
    }
    // Releasing focus (e.g. Esc out of pointer lock, alt-tab) can swallow the
    // keyup, leaving a key "stuck" — clear everything when the window blurs.
    const onBlur = () => {
      keys.current.forward = false
      keys.current.backward = false
      keys.current.left = false
      keys.current.right = false
      shiftHeld.current = false
      doubleTapped.current = false
      lastForwardDown = -Infinity
      refreshSprint()
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
