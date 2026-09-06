import { useFrame } from '@react-three/fiber'
import { useGame } from './store.js'

// The survival clock. Warmth bleeds away the entire time you're out in the
// arena; embers are the only way to buy it back. Drain runs only while you're
// actually in control (pointer locked), so sitting on the start prompt or the
// game-over screen doesn't cost you.
//
// Rendered inside <Canvas> for the frame loop, but draws nothing.
const DRAIN_PER_SECOND = 1.5 // ~66s from full with no pickups

export default function Survival() {
  useFrame((_, rawDelta) => {
    if (useGame.getState().status !== 'playing') return
    if (!document.pointerLockElement) return
    const delta = Math.min(rawDelta, 0.1)
    useGame.getState().tickWarmth(DRAIN_PER_SECOND * delta)
  })

  return null
}
