import { useEffect, useRef, useState } from 'react'
import {
  useGame,
  EMBER_SCORE,
  GREEN_EMBER_SCORE,
  GREEN_ESCAPE_BONUS,
} from './store.js'
import { DIFFICULTIES } from './difficulty.js'
import { threat } from './threat.js'
import { greenEmber } from './greenEmber.js'
import { shelter } from './shelter.js'
import { campfireGlow } from './campfire.js'
import { drops } from './drops.js'
import { ITEM_LABEL } from './inventory.js'
import MuteToggle from './MuteToggle.jsx'
import Manual from './Manual.jsx'

// A glanceable read on the yeti's attention so you don't have to swing the
// camera around mid-chase to check whether you've shaken it. Samples the shared
// threat readout (written in the frame loop, off React) and only re-renders when
// the state actually flips — chase -> search -> gone.
function ChaseState() {
  const [mode, setMode] = useState('idle')
  const raf = useRef()
  useEffect(() => {
    const tick = () => {
      setMode(threat.mode) // React bails the render when the value is unchanged
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
  if (mode === 'chase') return <div className="pursuit chasing">he sees you</div>
  if (mode === 'search') return <div className="pursuit searching">he&rsquo;s searching</div>
  if (mode === 'decoy') return <div className="pursuit distracted">he&rsquo;s distracted</div>
  if (mode === 'duck') return <div className="pursuit distracted">he&rsquo;s distracted</div>
  if (mode === 'poop') return <div className="pursuit grossed">he&rsquo;s grossed out</div>
  return null
}

// 6.7: flashes while the green ember's adrenaline sprint is available — inside
// its radius, or the escape window right after grabbing it. Same rAF-polled,
// render-only-on-change shape as ChaseState.
function AdrenalineCue() {
  const [on, setOn] = useState(false)
  const raf = useRef()
  useEffect(() => {
    const tick = () => {
      setOn(greenEmber.boost)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
  return on ? <div className="adrenaline">adrenaline</div> : null
}

// 6.12: shown while you're tucked inside a shed — a steady "hidden" that flips
// to a pulsing "he's at the door" once the yeti is checking the shed you're in
// and closing on it. Same rAF-polled, render-only-on-change shape as the others.
function ShelterCue() {
  const [state, setState] = useState('none') // 'none' | 'hidden' | 'rattled'
  const raf = useRef()
  useEffect(() => {
    const tick = () => {
      let next = 'none'
      if (shelter.inside) {
        next =
          shelter.yetiCheckIndex >= 0 &&
          shelter.yetiCheckIndex === shelter.shedIndex &&
          shelter.yetiCheckDist < 13
            ? 'rattled'
            : 'hidden'
      }
      setState(next)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
  if (state === 'rattled')
    return <div className="shelter rattled">he&rsquo;s at the door</div>
  if (state === 'hidden') return <div className="shelter">hidden</div>
  return null
}

// 7.14: rAF-polled read of the off-React campfireGlow.near flag (Campfire.jsx
// writes it), shared by the text cue below and the full-screen glow in the
// main Hud render — same render-only-on-change shape as the other cues.
function useCampfireNear() {
  const [near, setNear] = useState(false)
  const raf = useRef()
  useEffect(() => {
    const tick = () => {
      setNear(campfireGlow.near)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
  return near
}

// Shown while standing in a campfire's glow — the direct trade behind the
// warmth regen (Survival.jsx) and the detection balloon (Yeti.jsx).
function CampfireCue() {
  const near = useCampfireNear()
  return near ? <div className="campfire">warming &middot; exposed</div> : null
}

// 7.5: a soft arrow that orbits the crosshair, pointing the rough way back to
// the nearest item you've dropped (hold E / long-press a slot). Direction only,
// no distance — and the bearing is snapped to 8 headings, so it reads as "that
// way", not a precise vector. Polls the off-React `drops.bearing`, which
// Drops.jsx writes each frame; a CSS transition smooths the sector-to-sector
// jumps. Nothing dropped -> bearing is null -> nothing rendered.
function DropPip() {
  const [bearing, setBearing] = useState(null)
  const raf = useRef()
  useEffect(() => {
    const tick = () => {
      setBearing(drops.bearing) // React bails the render when unchanged
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])
  if (bearing == null) return null
  return (
    <div className="droppip" style={{ transform: `rotate(${bearing}rad)` }}>
      <span className="droppip-arrow" />
    </div>
  )
}

// 7.4: bottom-left inventory strip. One chip per carried item, numbered by slot;
// the first (what R drops) is lit, the rest dimmed. An active effect (the snack
// window, or standing on a 7.6 blanket) pulses above the strip. Plain store
// selectors — `slots` is a fresh array on every grab / use / drop, so this
// re-renders exactly when the inventory changes.
function InventoryCue() {
  const slots = useGame((s) => s.slots)
  const snackActive = useGame((s) => s.snackActive)
  const waterActive = useGame((s) => s.waterActive)
  const blanketActive = useGame((s) => s.blanketActive)
  const isTouch = useGame((s) => s.isTouch)
  const filled = slots
    .map((kind, i) => ({ kind, i }))
    .filter((entry) => entry.kind)
  if (!filled.length && !snackActive && !waterActive && !blanketActive)
    return null
  return (
    <div className="consumables">
      {(snackActive || waterActive) && (
        <div className={`consumable ${waterActive ? 'water' : 'snack'} active`}>
          {waterActive ? 'stamina locked · fast' : 'stamina locked'}
        </div>
      )}
      {blanketActive && (
        <div className="consumable blanket active">on blanket</div>
      )}
      {/* Desktop keymap reminder — each chip's number uses it, R drops the first.
          Touch drives the strip from the on-screen slot buttons, so it skips
          this line. */}
      {!isTouch && filled.length > 0 && (
        <div className="consumable cycle">
          <kbd>1</kbd>–<kbd>4</kbd> use &nbsp;·&nbsp; <kbd>R</kbd> drop 1st
        </div>
      )}
      {filled.map(({ kind, i }) => (
        <div
          key={i}
          className={`consumable ${kind}${i === 0 ? ' selected' : ''}`}
        >
          <kbd>{i + 1}</kbd> {ITEM_LABEL[kind]}
        </div>
      ))}
    </div>
  )
}

// A brief "dropped X" / "set down X" flash above the inventory strip — the
// confirm the drop keypress otherwise lacks. Subscribes to `dropReq`, the same
// edge counter dropSlot / a Q'd blanket bump for Drops.jsx; `pendingDrop` holds
// the kind and `pendingDropPlaced` tells a set-down blanket from a plain ditch.
// Store subscription rather than a selector so the message clears on its own
// timer without a re-render loop.
function DropToast() {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    let seen = useGame.getState().dropReq
    let timer = null
    const unsub = useGame.subscribe((s) => {
      if (s.dropReq === seen) return
      seen = s.dropReq
      if (!s.pendingDrop) return
      const label = ITEM_LABEL[s.pendingDrop]?.toLowerCase() ?? 'item'
      setMsg(s.pendingDropPlaced ? `Set down ${label}` : `Dropped ${label}`)
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), 1600)
    })
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [])
  if (!msg) return null
  return <div className="drop-toast">{msg}</div>
}

// Easy / Medium / Hard, shown on the start screen and every game-over card so
// you can dial the run down without digging through a menu. Hard is the original
// curve; Medium is the default. The choice sticks (localStorage) and reads live
// on the next frame — Survival.jsx and the Yeti pick it up straight away. Each
// button stops the click bubbling so it doesn't also grab pointer lock.
const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

function DifficultyPicker() {
  const difficulty = useGame((s) => s.difficulty)
  const setDifficulty = useGame((s) => s.setDifficulty)
  return (
    <div className="opt-picker">
      <span className="opt-picker-label">Difficulty</span>
      <div className="opt-picker-opts">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`opt-picker-opt${d === difficulty ? ' on' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setDifficulty(d)
            }}
          >
            {DIFF_LABEL[d]}
          </button>
        ))}
      </div>
    </div>
  )
}

// V also toggles this mid-run — this picker is the discoverable, tap-friendly
// twin of that key, reachable any time the game isn't actively running (start
// screen, pause, game-over) so touch players have a way in too.
const CAMERA_MODES = ['first', 'third']
const CAMERA_LABEL = { first: 'First-person', third: 'Third-person' }

function CameraModePicker() {
  const cameraMode = useGame((s) => s.cameraMode)
  const toggleCameraMode = useGame((s) => s.toggleCameraMode)
  return (
    <div className="opt-picker">
      <span className="opt-picker-label">View</span>
      <div className="opt-picker-opts">
        {CAMERA_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={`opt-picker-opt${m === cameraMode ? ' on' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (m !== cameraMode) toggleCameraMode()
            }}
          >
            {CAMERA_LABEL[m]}
          </button>
        ))}
      </div>
    </div>
  )
}

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
export default function Hud({ locked, isTouch }) {
  const status = useGame((s) => s.status)
  const score = useGame((s) => s.score)
  const level = useGame((s) => s.level)
  const elapsed = useGame((s) => s.elapsed)
  const warmth = useGame((s) => s.warmth)
  const stamina = useGame((s) => s.stamina)
  const sprintLocked = useGame((s) => s.sprintLocked)
  const jumpCharge = useGame((s) => s.jumpCharge)
  const itemsCollected = useGame((s) => s.itemsCollected)
  const itemsTotal = useGame((s) => s.itemsTotal)
  const embersTotal = useGame((s) => s.embersTotal)
  const greenCount = useGame((s) => s.greenCount)
  const escapes = useGame((s) => s.escapes)
  const interlude = useGame((s) => s.interlude)
  const nightfall = useGame((s) => s.nightfall)
  const snackActive = useGame((s) => s.snackActive)
  const waterActive = useGame((s) => s.waterActive)
  const blanketActive = useGame((s) => s.blanketActive)
  // 9.x: touch has no keyboard, so the "press R / N" end-screen prompts need
  // tap targets. Store actions are stable references.
  const reset = useGame((s) => s.reset)
  const resume = useGame((s) => s.resume)
  const startNightfall = useGame((s) => s.startNightfall)
  const reviveUsed = useGame((s) => s.reviveUsed)
  const revivePlayer = useGame((s) => s.revivePlayer)
  const campfireNear = useCampfireNear()

  // The first-time player's manual, opened from the start screen or the pause
  // card. Both of those only show while the game is idle or paused, so nothing
  // is running behind the overlay.
  const [manualOpen, setManualOpen] = useState(false)

  const playing = status === 'playing'
  const paused = status === 'paused'
  const over = status === 'caught' || status === 'frozen'
  const won = status === 'won'
  // 9.1: on a touch device there's no pointer lock to wait for — the run is
  // "engaged" the moment the game mounts. On desktop it still means locked.
  const engaged = locked || isTouch
  const showStats = engaged && (playing || paused)
  // The mute button is only reachable when the pointer isn't captured — i.e.
  // any time you're not mid-run: start screen, pause, game-over.
  const showMute = !(engaged && playing)

  const warmthPct = Math.max(0, Math.min(100, warmth))
  // 6.13 / 7.6: while you're stood on the blanket, the fill goes a warm amber
  // and the track glows — the drain's slower and the bar should say so at a glance.
  const warmthColor = blanketActive
    ? '#ffd18a'
    : warmthPct < 25
      ? '#ff5a4a'
      : warmthPct < 55
        ? '#ffb347'
        : '#6fd3ff'

  const staminaPct = Math.max(0, Math.min(100, stamina))
  const staminaColor = waterActive
    ? '#8fe6ff'
    : snackActive
      ? '#7dffb0'
      : sprintLocked
        ? '#ff5a4a'
        : staminaPct < 30
          ? '#ffd27a'
          : '#cfe9ff'

  // 7.12: small jump-charge bar under stamina — full and pale when ready,
  // dimmer amber while it's still recharging off a jump.
  const jumpPct = Math.max(0, Math.min(100, jumpCharge))
  const jumpReady = jumpPct >= 100
  const jumpColor = jumpReady ? '#cfe9ff' : '#ffb347'

  return (
    <div className={`hud${isTouch ? ' touch' : ''}`}>
      {/* Edges darken and redden as the yeti closes in — opacity is driven by
          the `--threat` CSS var that Sound.jsx updates each frame. On touch the
          `.hud.touch` scope (9.4) turns this frame into a full-viewport wash. */}
      <div className="vignette" />

      {/* Throbs on top of the vignette when the yeti is in pounce range mid-
          chase — a distinct "he's on you" cue you catch in your periphery.
          Driven by `--danger`. */}
      <div className="lunge" />

      {/* 7.2: icy white-out for the look-behind glance — irises in from the
          edges as the rear view frosts over, then melts once the camera flips
          back to front. Opacity is `--frost`, written every frame by Player.jsx. */}
      <div className="frost" />

      {/* 6.13 / 7.6: a soft warm inset glow the whole time you're on the blanket
          — the cosy counterpart to the cold vignette. */}
      {engaged && playing && blanketActive && <div className="blanketglow" />}

      {/* 7.14: a warmer, slightly redder inset while standing in a campfire's
          glow — distinct from the blanket's cosy tone since this one comes
          with a catch. */}
      {engaged && playing && campfireNear && <div className="campfireglow" />}

      {engaged && playing && <div className="crosshair" />}

      {engaged && playing && <ChaseState />}

      {engaged && playing && <AdrenalineCue />}

      {engaged && playing && <ShelterCue />}

      {engaged && playing && <CampfireCue />}

      {engaged && playing && <DropPip />}

      {engaged && playing && <InventoryCue />}

      {engaged && playing && <DropToast />}

      {showMute && <MuteToggle />}

      <Manual open={manualOpen} onClose={() => setManualOpen(false)} />

      {showStats && (
        <>
          <div className={`gauge${blanketActive ? ' shielded' : ''}`}>
            <span className="gauge-label">
              {blanketActive ? 'Warmth · blanket' : 'Warmth'}
            </span>
            <div className="gauge-track">
              <div
                className="gauge-fill"
                style={{ width: `${warmthPct}%`, background: warmthColor }}
              />
            </div>
          </div>

          <div
            className={`gauge stamina${snackActive || waterActive ? ' shielded' : ''}`}
          >
            <span className="gauge-label">
              {waterActive
                ? 'Stamina · water'
                : snackActive
                  ? 'Stamina · snack'
                  : sprintLocked
                    ? 'Winded'
                    : 'Stamina'}
            </span>
            <div className="gauge-track">
              <div
                className="gauge-fill"
                style={{ width: `${staminaPct}%`, background: staminaColor }}
              />
            </div>
          </div>

          <div className={`gauge jump${jumpReady ? ' ready' : ''}`}>
            <span className="gauge-label">{jumpReady ? 'Jump' : 'Jump · recharging'}</span>
            <div className="gauge-track">
              <div
                className="gauge-fill"
                style={{ width: `${jumpPct}%`, background: jumpColor }}
              />
            </div>
          </div>

          <div className="score">
            <div className="score-value">{score}</div>
            <div className="score-sub">
              {nightfall ? `Nightfall ${level}` : `Level ${level}`} · Embers{' '}
              {itemsCollected}/{itemsTotal}
            </div>
          </div>
        </>
      )}

      {engaged && playing && interlude && (
        <div className="prompt levelcard">
          <h1>
            {nightfall ? `Nightfall ${level + 1}` : `Level ${level + 1}`}
          </h1>
          <p>Catch your breath — the next wave is coming.</p>
        </div>
      )}

      {won && (
        <div className="prompt won">
          <h1>{nightfall ? 'The night is over' : 'Dawn breaks'}</h1>
          <p className="final">
            {nightfall
              ? `You cleared the nightfall — all ${level} again`
              : `You made it out — ${level} levels cleared`}
          </p>
          <div className="tally">
            <p>
              <span>Survived</span>
              <span>{formatTime(elapsed)}</span>
            </p>
            <p>
              <span>Embers</span>
              <span>
                {embersTotal} &times; {EMBER_SCORE}
              </span>
            </p>
            {greenCount > 0 && (
              <p>
                <span>Green embers</span>
                <span>
                  {greenCount} &times; {GREEN_EMBER_SCORE}
                </span>
              </p>
            )}
            {escapes > 0 && (
              <p>
                <span>Clean getaways</span>
                <span>
                  {escapes} &times; {GREEN_ESCAPE_BONUS}
                </span>
              </p>
            )}
            <p className="tally-total">
              <span>Score</span>
              <span>{score}</span>
            </p>
          </div>
          {isTouch ? (
            <div className="prompt-btns">
              {!nightfall && (
                <button
                  type="button"
                  className="prompt-btn ghost"
                  onClick={startNightfall}
                >
                  Nightfall
                </button>
              )}
              <button type="button" className="prompt-btn" onClick={reset}>
                Start over
              </button>
            </div>
          ) : (
            <p>
              {nightfall
                ? 'Press R to start over'
                : 'Press N for the nightfall — the same ten, harder · R to start over'}
            </p>
          )}
        </div>
      )}

      {!engaged && !over && !paused && !won && (
        <div className="prompt">
          {reviveUsed ? (
            <>
              {/* Post-revive: the pointer lock was released when the run ended
                  and Player.jsx's auto-recapture was refused — one click gets
                  it back. */}
              <h1>Back in</h1>
              <p>Click to take control</p>
            </>
          ) : (
            <>
              <h1>Yeti Survival</h1>
              <p>Click to look around</p>
              <p className="keys">
                WASD move &nbsp;·&nbsp; double-tap W / Shift / Mouse4 sprint &nbsp;·&nbsp; Space jump &nbsp;·&nbsp; 1–4 use item &nbsp;·&nbsp; R drop first item &nbsp;·&nbsp; click to glance back &nbsp;·&nbsp; Esc pause
              </p>
              <p className="keys">Grab the embers to stay warm — don&rsquo;t let the yeti reach you.</p>
              <DifficultyPicker />
              <CameraModePicker />
              <button
                type="button"
                className="prompt-btn ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  setManualOpen(true)
                }}
              >
                How to play
              </button>
            </>
          )}
        </div>
      )}

      {paused && (
        <div className="prompt">
          <h1>Paused</h1>
          <p>
            {locked
              ? 'Press Space or click Resume'
              : 'Click Resume to keep going'}
          </p>
          <CameraModePicker />
          <div className="prompt-btns">
            <button type="button" className="prompt-btn" onClick={resume}>
              Resume
            </button>
            <button
              type="button"
              className="prompt-btn ghost"
              onClick={(e) => {
                e.stopPropagation()
                setManualOpen(true)
              }}
            >
              How to play
            </button>
          </div>
        </div>
      )}

      {over && (
        <div className="prompt caught">
          <h1>{status === 'caught' ? 'The yeti caught you' : 'You froze to death'}</h1>
          {reviveUsed ? (
            <p className="final">
              {nightfall ? `Nightfall — level ${level}` : `Level ${level}`}
            </p>
          ) : (
            <>
              <p className="final">One more shot?</p>
              <p className="revive-sub">
                Pick up where you started — warmth back, the yeti thrown wide.
                Your run and score carry on. Just this once.
              </p>
            </>
          )}
          <div className="tally">
            <p>
              <span>Survived</span>
              <span>{formatTime(elapsed)}</span>
            </p>
            <p>
              <span>Embers</span>
              <span>
                {embersTotal} &times; {EMBER_SCORE}
              </span>
            </p>
            {greenCount > 0 && (
              <p>
                <span>Green embers</span>
                <span>
                  {greenCount} &times; {GREEN_EMBER_SCORE}
                </span>
              </p>
            )}
            {escapes > 0 && (
              <p>
                <span>Clean getaways</span>
                <span>
                  {escapes} &times; {GREEN_ESCAPE_BONUS}
                </span>
              </p>
            )}
            <p className="tally-total">
              <span>Score</span>
              <span>{score}</span>
            </p>
          </div>
          <DifficultyPicker />
          <CameraModePicker />
          {isTouch ? (
            reviveUsed ? (
              <button type="button" className="prompt-btn" onClick={reset}>
                Try again
              </button>
            ) : (
              <div className="prompt-btns">
                <button
                  type="button"
                  className="prompt-btn"
                  onClick={revivePlayer}
                >
                  Keep going
                </button>
                <button
                  type="button"
                  className="prompt-btn ghost"
                  onClick={reset}
                >
                  Start over
                </button>
              </div>
            )
          ) : (
            <p>
              {reviveUsed
                ? 'Press R to try again'
                : 'Press C to keep going · R to start over'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
