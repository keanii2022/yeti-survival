import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from './store.js'
import { mirror } from './mirror.js'
import {
  joystickVector,
  sprintLatch,
  touchMove,
  JOYSTICK_BASE_RADIUS,
  SPRINT_LATCH_RATIO,
} from './joystick.js'

// Step 9.2: the left-thumb movement joystick. A floating stick — it plants
// wherever the thumb first lands in the left zone — whose offset drives the
// `touchMove` singleton that Player's frame loop reads. Drag past the sprint
// ring to latch sprint, pull back inside the base radius to release. Replaces
// WASD + Shift on touch; never mounts on desktop.

// The stick only claims touches that start in the left slice of the screen —
// the right side is the 9.1 look zone.
const LEFT_ZONE_FRACTION = 0.45
// Knob travel is capped at the sprint ring so the visual can't fly off-screen
// on a big drag.
const KNOB_MAX = JOYSTICK_BASE_RADIUS * SPRINT_LATCH_RATIO

export default function TouchControls() {
  const isTouch = useGame((s) => s.isTouch)
  // Visual state only: where the base is planted and where the knob sits.
  const [stick, setStick] = useState(null)
  // Live drag state, off-React so touchmove doesn't re-render every frame.
  const drag = useRef({ id: null, ox: 0, oy: 0, sprint: false })

  const release = useCallback(() => {
    drag.current.id = null
    drag.current.sprint = false
    touchMove.x = 0
    touchMove.y = 0
    touchMove.mag = 0
    touchMove.sprint = false
    setStick(null)
  }, [])

  // Drop the stick if the component unmounts or the device flips out of touch.
  useEffect(() => release, [isTouch, release])

  if (!isTouch) return null

  const onStart = (e) => {
    if (drag.current.id !== null) return
    if (useGame.getState().status !== 'playing') return
    const t = e.changedTouches[0]
    drag.current.id = t.identifier
    drag.current.ox = t.clientX
    drag.current.oy = t.clientY
    drag.current.sprint = false
    setStick({ ox: t.clientX, oy: t.clientY, kx: 0, ky: 0, sprint: false })
  }

  const onMove = (e) => {
    if (drag.current.id === null) return
    let t = null
    for (const ct of e.changedTouches) {
      if (ct.identifier === drag.current.id) t = ct
    }
    if (!t) return
    const dx = t.clientX - drag.current.ox
    const dy = t.clientY - drag.current.oy
    const dist = Math.hypot(dx, dy)

    const v = joystickVector(dx, dy)
    const sprint = sprintLatch(drag.current.sprint, dist)
    if (sprint && !drag.current.sprint) navigator.vibrate?.(10)
    drag.current.sprint = sprint

    touchMove.x = v.x
    touchMove.y = v.y
    touchMove.mag = v.mag
    touchMove.sprint = sprint

    const clamp = dist > KNOB_MAX ? KNOB_MAX / dist : 1
    setStick({
      ox: drag.current.ox,
      oy: drag.current.oy,
      kx: dx * clamp,
      ky: dy * clamp,
      sprint,
    })
  }

  const onEnd = (e) => {
    if (drag.current.id === null) return
    for (const ct of e.changedTouches) {
      if (ct.identifier === drag.current.id) {
        release()
        return
      }
    }
  }

  return (
    <>
      <div
        data-touch-control="joystick"
        className="joystick-zone"
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
        style={{ width: `${LEFT_ZONE_FRACTION * 100}vw` }}
      >
        {stick && (
          <>
            <div
              className="joystick-base"
              style={{ left: `${stick.ox}px`, top: `${stick.oy}px` }}
            />
            {/* Always-on sprint ring: the threshold you push the knob past to
                latch a run. Invisible before 9.3, so walk vs run was guesswork —
                now you can see the line and see the knob cross it. */}
            <div
              className={`joystick-sprint-ring${stick.sprint ? ' latched' : ''}`}
              style={{
                left: `${stick.ox}px`,
                top: `${stick.oy}px`,
                width: `${KNOB_MAX * 2}px`,
                height: `${KNOB_MAX * 2}px`,
              }}
            />
            <div
              className={`joystick-knob${stick.sprint ? ' sprint' : ''}`}
              style={{
                left: `${stick.ox + stick.kx}px`,
                top: `${stick.oy + stick.ky}px`,
              }}
            >
              {stick.sprint ? 'RUN' : ''}
            </div>
          </>
        )}
      </div>
      {stick && (
        <div className={`move-state${stick.sprint ? ' running' : ''}`}>
          {stick.sprint ? 'RUN' : 'WALK'}
        </div>
      )}
      <TouchButtons />
    </>
  )
}

// A single action button. Fires on `touchstart`, not `click`: iOS Safari won't
// synthesize a click for a finger that lands while another touch is already
// down, so with `onClick` the buttons went dead the whole time you were driving
// the movement joystick. `touchstart` is delivered per-finger, always. The
// trailing ghost `click` is swallowed by the timestamp guard; `onClick` stays
// as the path for any non-touch input that reaches here. Each press just
// re-dispatches the desktop keydown so the L / E / Q / F handlers stay the one
// source of truth.
function ActionButton({ code, label, sub, className = '' }) {
  const lastTouch = useRef(0)
  const fire = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }))
  }
  return (
    <button
      type="button"
      data-touch-control="button"
      className={`touch-btn ${className}`.trim()}
      onTouchStart={() => {
        lastTouch.current = Date.now()
        fire()
      }}
      onClick={() => {
        if (Date.now() - lastTouch.current < 700) return
        fire()
      }}
    >
      {label}
      <small>{sub}</small>
    </button>
  )
}

// Step 9.3: the right-thumb action buttons. One stack in the bottom-right,
// clear of where a look-drag or the joystick lands. L is always up while
// playing (dimmed through its cooldown); E/Q/F only mount while that item is
// carried. Tagged data-touch-control so a press can't leak into the 9.1
// drag-look zone.
function TouchButtons() {
  const status = useGame((s) => s.status)
  const hasSnack = useGame((s) => s.hasSnack)
  const hasBlanket = useGame((s) => s.hasBlanket)
  const hasDecoy = useGame((s) => s.hasDecoy)
  // mirror.ready is an off-React singleton — poll it so the L button can dim
  // for the glance-plus-cooldown span, same tell as the HUD's LookHint chip.
  const [glanceReady, setGlanceReady] = useState(true)
  useEffect(() => {
    let raf
    const tick = () => {
      setGlanceReady(mirror.ready)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (status !== 'playing') return null

  return (
    <div data-touch-control="buttons" className="touch-buttons">
      <ActionButton
        code="KeyL"
        label="L"
        sub="look"
        className={glanceReady ? '' : 'cooling'}
      />
      {hasSnack && <ActionButton code="KeyE" label="E" sub="snack" />}
      {hasBlanket && <ActionButton code="KeyQ" label="Q" sub="blanket" />}
      {hasDecoy && <ActionButton code="KeyF" label="F" sub="decoy" />}
    </div>
  )
}
