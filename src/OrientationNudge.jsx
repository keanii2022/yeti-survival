import { useEffect, useState } from 'react'
import { useGame } from './store.js'
import { isPortrait } from './orientation.js'

// Step 9.6: rotate-to-landscape nudge. Touch only. The joystick zone, the look
// zone and the responsive HUD are all built for a viewport that's wider than it
// is tall — held upright the controls overlap and the game-over tally clips —
// so while the phone is in portrait we cover the screen with a "turn your
// phone" card. It's a nudge, not a pause: the run keeps ticking underneath,
// the same as if you'd looked away from the screen.
export default function OrientationNudge() {
  const isTouch = useGame((s) => s.isTouch)
  const [portrait, setPortrait] = useState(() => isPortrait())

  useEffect(() => {
    if (!isTouch) return
    const update = () => setPortrait(isPortrait())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [isTouch])

  if (!isTouch || !portrait) return null

  return (
    <div className="rotate-nudge" data-touch-control="rotate">
      <div className="rotate-nudge-phone" />
      <p className="rotate-nudge-title">Rotate your phone</p>
      <p className="rotate-nudge-sub">Yeti Survival plays in landscape</p>
    </div>
  )
}
