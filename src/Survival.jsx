import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGame } from './store.js'
import { shelter } from './shelter.js'
import { campfireGlow, CAMPFIRE_REGEN_PER_SECOND } from './campfire.js'
import { weather, intoWindFactor, GUST_DRAIN_MULT } from './weather.js'
import { inControl } from './touch.js'
import { difficultyMods } from './difficulty.js'
import { playerBody } from './playerBody.js'

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
  const lastX = useRef(playerBody.x)
  const lastZ = useRef(playerBody.z)

  useFrame((_, rawDelta) => {
    if (useGame.getState().status !== 'playing') return
    if (!inControl(useGame.getState().isTouch)) return
    const delta = Math.min(rawDelta, 0.1)
    // 7.16: how much of this frame's move was straight into an active gust's
    // heading, before updating the tracked position for next frame.
    const moveX = playerBody.x - lastX.current
    const moveZ = playerBody.z - lastZ.current
    const into = weather.gustAmount > 0 ? intoWindFactor(moveX, moveZ) : 0
    lastX.current = playerBody.x
    lastZ.current = playerBody.z
    // The run clock keeps counting through the 6.6 interlude, but warmth doesn't
    // drain during the breather — that's what makes it a breather.
    useGame.getState().tickTime(delta)
    if (useGame.getState().interlude) return
    // 'medium' / 'easy' bleed warmth slower than the base HARD rate.
    let rate =
      DRAIN_PER_SECOND *
      difficultyMods(useGame.getState().difficulty).warmthDrain
    if (shelter.inside) rate *= SHED_DRAIN_FACTOR
    if (useGame.getState().blanketActive) rate *= BLANKET_DRAIN_FACTOR
    // 7.16: walking straight into a gust bites harder, up to GUST_DRAIN_MULT at
    // full strength and dead into the wind; crossing or moving with it costs
    // nothing extra.
    rate *= 1 + (GUST_DRAIN_MULT - 1) * weather.gustAmount * into
    // 7.14: campfire glow outweighs whatever drain is left and flips the rate
    // negative, so tickWarmth tops the bar back up instead of bleeding it —
    // the direct trade for standing somewhere the yeti can spot you from
    // further off (Yeti.jsx reads the same campfireGlow.near flag).
    if (campfireGlow.near) rate -= CAMPFIRE_REGEN_PER_SECOND
    useGame.getState().tickWarmth(rate * delta)
  })

  return null
}
