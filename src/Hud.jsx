// Flat DOM overlay drawn on top of the canvas. Shows the "click to play"
// prompt while unlocked, a crosshair once you're in control, and a "caught"
// screen when the yeti reaches you.
export default function Hud({ locked, status, onReset }) {
  const caught = status === 'caught'

  return (
    <div className="hud">
      {locked && !caught && <div className="crosshair" />}

      {!locked && !caught && (
        <div className="prompt">
          <h1>Yeti Survival</h1>
          <p>Click to look around</p>
          <p className="keys">WASD move &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; Esc release</p>
        </div>
      )}

      {caught && (
        <div className="prompt caught" onClick={onReset}>
          <h1>The yeti caught you</h1>
          <p>Click to try again</p>
        </div>
      )}
    </div>
  )
}
