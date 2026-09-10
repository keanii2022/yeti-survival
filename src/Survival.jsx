import { useFrame } from '@react-three/fiber'
import { useGame } from './store.js'
import { shelter } from './shelter.js'
import { inControl } from './touch.js'

// The survival clock. Warmth bleeds away the entire time you're out in the
// arena; embers buy a little of it back. This also advances the run timer that
// the game-over screen reports. Both run only while you're actually in control
// (pointer locked), so sitting on the start prompt or the game-over screen
// doesn't drain warmth or pad your time.
//
// Rendered inside <Canvas> for the frame loop, but draws nothing.
//
// ~25s from full with no pickups. Was 10/s (a 10s clock) at 60x60; 6.10 doubled
// every distance and 6.6 eased it twice (5 → 4.5 → 4) — the level waves want
// real time to go and find, and getting stuck searching shouldn't be an instant
// freeze. The interlude (warmth paused) is the other half of the breathing room.
const DRAIN_PER_SECOND = 4

// 6.12: tucked inside a shed the cold bites slower — but not zero. Hiding buys
// time, it doesn't stop the clock, so camping a shed still freezes you eventually.
const SHED_DRAIN_FACTOR = 0.45

// 6.13 / 7.6: the blanket. Warmth still ticks while you stand on the set-down
// blanket (blanketActive, flipped by Drops.jsx on proximity) — it buys a long
// hold on one spot, not a stopped clock. No window now: it lasts as long as you
// stay on it. Stacks with the shed factor if you lay it inside one.
const BLANKET_DRAIN_FACTOR = 0.3

export default function Survival() {
  useFrame((_, rawDelta) => {
    if (useGame.getState().status !== 'playing') return
    if (!inControl(useGame.getState().isTouch)) return
    const delta = Math.min(rawDelta, 0.1)
    // The run clock keeps counting through the 6.6 interlude, but warmth doesn't
    // drain during the breather — that's what makes it a breather.
    useGame.getState().tickTime(delta)
    if (useGame.getState().interlude) return
    let rate = DRAIN_PER_SECOND
    if (shelter.inside) rate *= SHED_DRAIN_FACTOR
    if (useGame.getState().blanketActive) rate *= BLANKET_DRAIN_FACTOR
    useGame.getState().tickWarmth(rate * delta)
  })

  return null
}
