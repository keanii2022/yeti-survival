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
import { lockWalk } from './inventory.js'
import { requestFullscreen } from './orientation.js'
import { qualityFor } from './quality.js'
import './App.css'

// Digit1..Digit4 / Numpad1..Numpad4 -> a zero-based inventory slot index.
const SLOT_KEY = /^(?:Digit|Numpad)([1-4])$/

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

  // Global keys that aren't movement. Handled here rather than in the pointer-
  // lock controller so they work whether or not the mouse is captured.
  //
  //   Space      pause / resume
  //   N          take the nightfall from the win screen
  //   C          the first-death second chance (Hud.jsx)
  //   R          while playing: drop your first carried item (slot 1); on a
  //              game-over / win card: restart — the two never overlap in time
  //   1..4       use the item in that slot (also Numpad 1-4)
  //   Q          use your first carried item (slot 1) — a shorthand for "1"
  //
  // The carried items always pack left with no gaps (store `compact`), so a
  // number always lines up with the chip it's under and "drop first" is
  // unambiguous. This replaced the 7.4 "E cycles a hidden selection / hold-E
  // drops" scheme, which missed a lot in practice.
  useEffect(() => {
    const onKey = (e) => {
      const slotKey = SLOT_KEY.exec(e.code)
      if (e.code === 'Space') {
        e.preventDefault()
        const { status, pause, resume } = useGame.getState()
        if (status === 'playing') pause()
        else if (status === 'paused') resume()
      } else if (e.code === 'KeyR' && !e.repeat) {
        const s = useGame.getState()
        if (s.status === 'caught' || s.status === 'frozen' || s.status === 'won')
          s.reset()
        else if (s.status === 'playing' && !s.interlude && s.slots[0] != null)
          s.dropSlot(0)
      } else if (e.code === 'KeyC') {
        // One-time second chance offered on the first death screen (Hud.jsx).
        const { status, reviveUsed, revivePlayer } = useGame.getState()
        if ((status === 'caught' || status === 'frozen') && !reviveUsed)
          revivePlayer()
      } else if (e.code === 'KeyN') {
        const { status, nightfall, startNightfall } = useGame.getState()
        if (status === 'won' && !nightfall) startNightfall()
      } else if ((e.code === 'KeyQ' || slotKey) && !e.repeat) {
        const s = useGame.getState()
        const i = slotKey ? Number(slotKey[1]) - 1 : 0
        if (s.status === 'playing' && !s.interlude && s.slots[i] != null) {
          s.useSlot(i)
          lockWalk()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
