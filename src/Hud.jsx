// Flat DOM overlay drawn on top of the canvas. Shows the "click to play"
// prompt while the pointer is unlocked and a crosshair once you're in control.
export default function Hud({ locked }) {
  return (
    <div className="hud">
      {locked && <div className="crosshair" />}
      {!locked && (
        <div className="prompt">
          <h1>Yeti Survival</h1>
          <p>Click to look around</p>
          <p className="keys">WASD move &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; Esc release</p>
        </div>
      )}
    </div>
  )
}
