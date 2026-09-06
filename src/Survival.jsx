import { useFrame } from '@react-three/fiber'
import { useGame } from './store.js'

// The survival clock. Warmth bleeds away the entire time you're out in the
// arena; embers buy a little of it back. This also advances the run timer that
// the game-over screen reports. Both run only while you're actually in control
// (pointer locked), so sitting on the start prompt or the game-over screen
// doesn't drain warmth or pad your time.
//
// Rendered inside <Canvas> for the frame loop, but draws nothing.
const DRAIN_PER_SECOND = 10 // ~10s from full with no pickups — embers are the lifeline

export default function Survival() {
  useFrame((_, rawDelta) => {
    if (useGame.getState().status !== 'playing') return
    if (!document.pointerLockElement) return
    const delta = Math.min(rawDelta, 0.1)
    useGame.getState().tickTime(delta)
    useGame.getState().tickWarmth(DRAIN_PER_SECOND * delta)
  })

  return null
}
