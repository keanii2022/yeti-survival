import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGame } from './store.js'
import { threat } from './threat.js'
import { getAtmosphere } from './sound.js'
import { effectiveLevel } from './levels.js'

// Step 5: wires the synthesised atmosphere (see sound.js) to the game.
// Step 6.4: also forwards the raw threat.mode so the engine can cross-fade the
// calm bed and the chase strings.
//
//  - resumes the AudioContext on the first user gesture
//  - every frame, turns the Yeti's distance into a 0..1 threat level that drives
//    the heartbeat + dread drone, passes threat.mode for the calm/strings
//    cross-fade, and mirrors the level onto a `--threat` CSS var so the HUD
//    vignette pulses in time
//  - fires one-shots on the state changes that matter: lock-on stinger, ember
//    chime, game-over boom, pause/resume ducking
//
// Rendered inside <Canvas> for the frame loop; draws nothing.

// Past this range the yeti is inaudible; the pre-chase ramp starts here.
const NEAR = 30
// Inside this range mid-chase he's within lunging distance — drives the pulsing
// red HUD frame (see .lunge in App.css). Matches the yeti's BURST_RADIUS with a
// hair of lead-in.
const LUNGE_RANGE = 7

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export default function Sound() {
  const prevMode = useRef('idle')
  const prevStatus = useRef('playing')
  const prevItems = useRef(0)
  const prevGreen = useRef(0)
  const prevEscapes = useRef(0)

  // Wake the audio engine on the first pointer interaction (the click that grabs
  // pointer-lock is one); the pointerlockchange is a belt-and-braces fallback.
  useEffect(() => {
    const wake = () => getAtmosphere()?.resume()
    window.addEventListener('pointerdown', wake)
    document.addEventListener('pointerlockchange', wake)
    return () => {
      window.removeEventListener('pointerdown', wake)
      document.removeEventListener('pointerlockchange', wake)
    }
  }, [])

  // Fresh scene (mount, or a remount on restart): clear the shared readout and
  // bring the ambience back if a previous run's game-over had ducked it.
  useEffect(() => {
    threat.distance = Infinity
    threat.mode = 'idle'
    threat.yetiX = 0
    threat.yetiZ = 0
    prevMode.current = 'idle'
    prevStatus.current = 'playing'
    prevItems.current = 0
    prevGreen.current = 0
    prevEscapes.current = 0
    getAtmosphere()?.revive()
    const root = document.documentElement.style
    root.setProperty('--threat', '0')
    root.setProperty('--danger', '0')
    return () => {
      root.setProperty('--threat', '0')
      root.setProperty('--danger', '0')
    }
  }, [])

  useFrame((_, rawDelta) => {
    const eng = getAtmosphere()
    if (!eng) return
    const delta = Math.min(rawDelta, 0.1)
    const { status, embersTotal, greenCount, escapes, level, interlude, nightfall } =
      useGame.getState()

    // --- state-change one-shots ---
    if (status !== prevStatus.current) {
      if (status === 'paused') eng.setPaused(true)
      else if (status === 'playing') eng.setPaused(false)
      else if (status === 'caught' || status === 'frozen') {
        eng.update(0, 0, 'idle')
        eng.gameOver(status)
        document.documentElement.style.setProperty('--threat', '0')
        document.documentElement.style.setProperty('--danger', '0')
      } else if (status === 'won') {
        eng.update(0, 0, 'idle')
        eng.win()
        document.documentElement.style.setProperty('--threat', '0')
        document.documentElement.style.setProperty('--danger', '0')
      }
      prevStatus.current = status
    }

    if (status !== 'playing') return

    // Lock-on: fire the stinger the frame the yeti flips into the chase.
    if (threat.mode === 'chase' && prevMode.current !== 'chase') eng.stinger()
    prevMode.current = threat.mode

    // Ember chime — off the run-long count so it still fires after the per-level
    // counter resets between waves.
    if (embersTotal > prevItems.current) eng.pickup()
    prevItems.current = embersTotal

    // Green-ember cues (6.7): a richer chime on the grab, a rising flourish when
    // it clears the yeti's range.
    if (greenCount > prevGreen.current) eng.greenPickup()
    prevGreen.current = greenCount
    if (escapes > prevEscapes.current) eng.escape()
    prevEscapes.current = escapes

    // --- threat level → heartbeat / drone / vignette ---
    // During a chase the level tracks how close he actually is (0.7 at the edge
    // of the chase → 1 breathing down your neck) so the heartbeat and vignette
    // tell you where he is when you can't look back. 'search' (6.11): he lost
    // you but is still hunting your trail — the bed stays up a notch while the
    // chase strings pull out, so the drop is audible the moment he breaks off.
    let threatLevel = 0
    if (threat.mode === 'chase') threatLevel = clamp(1 - threat.distance / 30, 0.7, 1)
    else if (threat.mode === 'search') threatLevel = 0.5
    else if (threat.distance < NEAR) threatLevel = clamp((NEAR - threat.distance) / 24, 0, 0.8)

    // 6.6 darkness drive: climbs with the effective level (nightfall starts it
    // high), snaps to 0 for the interlude so the bed strips back to the light
    // layer.
    const drive = interlude ? 0 : clamp((effectiveLevel(level, nightfall) - 1) / 6, 0, 1)

    eng.update(delta, threatLevel, threat.mode, drive)
    document.documentElement.style.setProperty('--threat', threatLevel.toFixed(3))

    // Separate "he's lunging" readout: only mid-chase and only in the last few
    // metres. The HUD frame pulses on this, distinct from the steady vignette.
    const danger =
      threat.mode === 'chase'
        ? clamp((LUNGE_RANGE - threat.distance) / LUNGE_RANGE, 0, 1)
        : 0
    document.documentElement.style.setProperty('--danger', danger.toFixed(3))
  })

  return null
}
