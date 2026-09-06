import { useGame } from './store.js'

// Flat DOM overlay drawn on top of the canvas: warmth meter and score while a
// run is live, the "click to play" prompt while unlocked, a pause card, and a
// game-over card — for the yeti or for the cold — once the run ends.
export default function Hud({ locked }) {
  const status = useGame((s) => s.status)
  const score = useGame((s) => s.score)
  const warmth = useGame((s) => s.warmth)
  const itemsCollected = useGame((s) => s.itemsCollected)
  const itemsTotal = useGame((s) => s.itemsTotal)

  const playing = status === 'playing'
  const paused = status === 'paused'
  const over = status === 'caught' || status === 'frozen'
  const showStats = locked && (playing || paused)

  const warmthPct = Math.max(0, Math.min(100, warmth))
  const warmthColor =
    warmthPct < 25 ? '#ff5a4a' : warmthPct < 55 ? '#ffb347' : '#6fd3ff'

  return (
    <div className="hud">
      {/* Edges darken and redden as the yeti closes in — opacity is driven by
          the `--threat` CSS var that Sound.jsx updates each frame. */}
      <div className="vignette" />

      {locked && playing && <div className="crosshair" />}

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
          <p className="final">Final score {score}</p>
          <p className="keys">Embers collected {itemsCollected}/{itemsTotal}</p>
          <p>Press R to try again</p>
        </div>
      )}
    </div>
  )
}
