import { useState } from 'react'
import { getAtmosphere, readMutedPref, writeMutedPref } from './sound.js'

// Speaker button in the HUD's bottom-left corner. The Hud only mounts it while
// you're out of active play (start screen, pause, game-over) — during a locked
// run the pointer is captured and you couldn't click it anyway.
//
// The engine owns the actual mute (its `out` gain node); this component reflects
// the stored preference and flips it. The engine may not exist yet on the start
// screen, so we persist the choice here too — the engine reads the same stored
// value from its constructor whenever it is finally built.
export default function MuteToggle() {
  const [muted, setMuted] = useState(readMutedPref)

  const toggle = () => {
    const next = !muted
    setMuted(next)
    writeMutedPref(next)
    getAtmosphere()?.setMuted(next)
  }

  return (
    <button
      type="button"
      className="mute-toggle"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? 'Unmute audio' : 'Mute audio'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
