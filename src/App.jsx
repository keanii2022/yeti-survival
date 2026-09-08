import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Snow from './Snow.jsx'
import Player from './Player.jsx'
import Yeti from './Yeti.jsx'
import Footprints from './Footprints.jsx'
import Sheds from './Sheds.jsx'
import Items from './Items.jsx'
import GreenEmber from './GreenEmber.jsx'
import Consumables from './Consumables.jsx'
import Decoy from './Decoy.jsx'
import Drops from './Drops.jsx'
import Levels from './Levels.jsx'
import Survival from './Survival.jsx'
import Sound from './Sound.jsx'
import Hud from './Hud.jsx'
import TouchControls from './TouchControls.jsx'
import OrientationNudge from './OrientationNudge.jsx'
import { useGame } from './store.js'
import { detectCoarsePointer } from './touch.js'
import { lockWalk, DROP_HOLD_MS } from './inventory.js'
import { requestFullscreen } from './orientation.js'
import { qualityFor } from './quality.js'
import './App.css'

export default function App() {
  const [locked, setLocked] = useState(false)
  const runId = useGame((s) => s.runId)
  const isTouch = useGame((s) => s.isTouch)
  // Step 9.5: on a touch device the whole scene renders on a lighter budget —
  // clamped DPR, cheaper shadows, thinner tree stand and snow. Desktop reads
  // the same values it always had.
  const quality = qualityFor(isTouch)

  // Step 9.1: decide once whether this is a touch device. matchMedia catches
  // phones up front; the one-shot touchstart listener is the fallback for
  // anything that reports a fine pointer until it's actually touched (some
  // hybrids, some emulators). Latched in the store, never unset.
  //
  // Step 9.6: the same first touch is the gesture we spend on a fullscreen
  // request — browsers only grant it from inside a user handler. Gated on a
  // coarse pointer so a tap on a hybrid laptop's touchscreen doesn't yank the
  // desktop path into fullscreen; on a phone that has no Fullscreen API (iOS
  // Safari) requestFullscreen just no-ops and the home-screen manifest carries
  // the chromeless launch instead.
  useEffect(() => {
    const { setTouch } = useGame.getState()
    const coarse = detectCoarsePointer()
    if (coarse) setTouch()
    const onTouch = () => {
      setTouch()
      if (coarse) requestFullscreen()
    }
    window.addEventListener('touchstart', onTouch, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', onTouch)
  }, [])

  // Track pointer-lock state at the document level so the HUD can react to it
  // without reaching into the controls instance.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  // Global keys that aren't movement: Space toggles pause, R restarts once the
  // run is over, N takes the nightfall from the win screen, and — Step 7.4 —
  // Q spends the selected inventory slot. Handled here rather than in the
  // pointer-lock controller so they work whether or not the mouse is captured.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        const { status, pause, resume } = useGame.getState()
        if (status === 'playing') pause()
        else if (status === 'paused') resume()
      } else if (e.code === 'KeyR') {
        const { status, reset } = useGame.getState()
        if (status === 'caught' || status === 'frozen' || status === 'won') reset()
      } else if (e.code === 'KeyN') {
        const { status, nightfall, startNightfall } = useGame.getState()
        if (status === 'won' && !nightfall) startNightfall()
      } else if (e.code === 'KeyQ' && !e.repeat) {
        const s = useGame.getState()
        if (
          s.status === 'playing' &&
          !s.interlude &&
          s.slots[s.selectedSlot] != null
        ) {
          s.useSlot(s.selectedSlot)
          lockWalk()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 7.4 / 7.5: E is tap-or-hold. A tap (released before DROP_HOLD_MS) cycles the
  // selected slot; holding it past that window drops that slot's item into the
  // world for the 7.5 pip to point back at. No walk-lock on a drop — you can
  // ditch a thing without breaking stride (playtest call). The keyup half is
  // why this sits apart from the keydown-only globals above.
  useEffect(() => {
    let holdTimer = null
    let consumed = false // the hold fired a drop — swallow the pending tap
    const clearHold = () => {
      if (holdTimer) {
        clearTimeout(holdTimer)
        holdTimer = null
      }
    }
    const onDown = (e) => {
      if (e.code !== 'KeyE' || e.repeat || holdTimer || consumed) return
      holdTimer = setTimeout(() => {
        holdTimer = null
        consumed = true
        const s = useGame.getState()
        if (
          s.status === 'playing' &&
          !s.interlude &&
          s.slots[s.selectedSlot] != null
        ) {
          s.dropSlot(s.selectedSlot)
        }
      }, DROP_HOLD_MS)
    }
    const onUp = (e) => {
      if (e.code !== 'KeyE') return
      clearHold()
      if (consumed) {
        consumed = false
        return
      }
      const s = useGame.getState()
      if (s.status === 'playing' && !s.interlude) s.cycleSlot()
    }
    const onBlur = () => {
      clearHold()
      consumed = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
      clearHold()
    }
  }, [])

  return (
    <>
      {/* Keyed on runId: a reset remounts the whole scene, snapping the camera
          back to the spawn and the yeti back to its post. */}
      <Canvas
        key={runId}
        shadows={quality.shadows}
        dpr={[1, quality.maxDpr]}
        camera={{ position: [0, 1.7, 8], fov: 70, near: 0.1, far: 320 }}
      >
        <World />
        <Snow />
        <Player />
        <Yeti />
        <Footprints />
        <Sheds />
        <Items />
        <GreenEmber />
        <Consumables />
        <Decoy />
        <Drops />
        <Levels />
        <Survival />
        <Sound />
      </Canvas>
      <Hud locked={locked} isTouch={isTouch} />
      <TouchControls />
      <OrientationNudge />
    </>
  )
}
