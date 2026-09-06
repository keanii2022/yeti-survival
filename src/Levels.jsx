import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGame } from './store.js'
import { INTERLUDE_SECONDS } from './levels.js'

// Step 6.6: runs the between-levels interlude clock. When collectItem() clears a
// level it flips `interlude` on; this counts down INTERLUDE_SECONDS of real time
// and then calls endInterlude(), which advances the level and lets Items spawn
// the next wave. Warmth drain is paused elsewhere (Survival.jsx) while it runs.
//
// The countdown is seeded and ticked entirely inside useFrame — an effect can't
// be trusted to run before the next frame, and a frame that saw `interlude`
// true with the timer still at 0 would end the breather instantly.
//
// Rendered inside <Canvas> for the frame loop; draws nothing.
export default function Levels() {
  const timer = useRef(0)
  const wasInterlude = useRef(false)

  useFrame((_, rawDelta) => {
    const { interlude, status, endInterlude } = useGame.getState()

    // Edge: the interlude just began — start the clock.
    if (interlude && !wasInterlude.current) timer.current = INTERLUDE_SECONDS
    wasInterlude.current = interlude

    if (!interlude) return
    // Only burn the clock while the player's actually in control, matching the
    // survival clock — a paused or unlocked interlude doesn't tick away.
    if (status !== 'playing') return
    if (!document.pointerLockElement) return

    timer.current -= Math.min(rawDelta, 0.1)
    if (timer.current <= 0) endInterlude()
  })

  return null
}
