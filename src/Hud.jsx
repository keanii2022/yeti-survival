import { useGame, EMBER_SCORE } from './store.js'
import MuteToggle from './MuteToggle.jsx'

// Whole seconds -> "M:SS" for the game-over readout.
function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Flat DOM overlay drawn on top of the canvas: warmth meter and score while a
// run is live, the "click to play" prompt while unlocked, a pause card, and a
// game-over card — for the yeti or for the cold — once the run ends.
export default function Hud({ locked }) {
  const status = useGame((s) => s.status)
  const score = useGame((s) => s.score)
  const level = useGame((s) => s.level)
  const elapsed = useGame((s) => s.elapsed)
  const warmth = useGame((s) => s.warmth)
  const stamina = useGame((s) => s.stamina)
  const sprintLocked = useGame((s) => s.sprintLocked)
  const itemsCollected = useGame((s) => s.itemsCollected)
  const itemsTotal = useGame((s) => s.itemsTotal)

  const playing = status === 'playing'
  const paused = status === 'paused'
  const over = status === 'caught' || status === 'frozen'
  const showStats = locked && (playing || paused)
  // The mute button is only reachable when the pointer isn't captured — i.e.
  // any time you're not mid-run: start screen, pause, game-over.
  const showMute = !(locked && playing)

  const warmthPct = Math.max(0, Math.min(100, warmth))
  const warmthColor =
    warmthPct < 25 ? '#ff5a4a' : warmthPct < 55 ? '#ffb347' : '#6fd3ff'

  const staminaPct = Math.max(0, Math.min(100, stamina))
  const staminaColor = sprintLocked
    ? '#ff5a4a'
    : staminaPct < 30
      ? '#ffd27a'
      : '#cfe9ff'

  return (
    <div className="hud">
      {/* Edges darken and redden as the yeti closes in — opacity is driven by
          the `--threat` CSS var that Sound.jsx updates each frame. */}
      <div className="vignette" />

      {locked && playing && <div className="crosshair" />}

      {showMute && <MuteToggle />}

      {showStats && (
        <>
          <div className="gauge">
            <span className="gauge-label">Warmth</span>
            <div className="gauge-track">
              <div
                className="gauge-fill"
                style={{ width: `${warmthPct}%`, background: warmthColor }}
              />
            </div>
          </div>

          <div className="gauge stamina">
            <span className="gauge-label">
              {sprintLocked ? 'Winded' : 'Stamina'}
            </span>
            <div className="gauge-track">
              <div
                className="gauge-fill"
                style={{ width: `${staminaPct}%`, background: staminaColor }}
              />
            </div>
          </div>

          <div className="score">
            <div className="score-value">{score}</div>
            <div className="score-sub">
              Embers {itemsCollected}/{itemsTotal}
            </div>
          </div>
        </>
      )}

      {!locked && !over && !paused && (
        <div className="prompt">
          <h1>Yeti Survival</h1>
          <p>Click to look around</p>
          <p className="keys">
            WASD move &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; Space pause &nbsp;·&nbsp; Esc release
          </p>
          <p className="keys">Grab the embers to stay warm — don&rsquo;t let the yeti reach you.</p>
        </div>
      )}

      {paused && (
        <div className="prompt">
          <h1>Paused</h1>
          <p>Press Space to resume</p>
        </div>
      )}

      {over && (
        <div className="prompt caught">
          <h1>{status === 'caught' ? 'The yeti caught you' : 'You froze to death'}</h1>
          <p className="final">Level {level}</p>
          <div className="tally">
            <p>
              <span>Survived</span>
              <span>{formatTime(elapsed)}</span>
            </p>
            <p>
              <span>
                Embers {itemsCollected}/{itemsTotal}
              </span>
              <span>
                {itemsCollected} &times; {EMBER_SCORE}
              </span>
            </p>
            <p className="tally-total">
              <span>Score</span>
              <span>{score}</span>
            </p>
          </div>
          <p>Press R to try again</p>
        </div>
      )}
    </div>
  )
}
