import * as THREE from 'three'

// The player's true ground-plane position and facing — an off-React
// singleton, same shape as mirror.js / inventory.js. Every gameplay system
// (yeti detection, footprints, throws, pickups, shed hiding, pond cracking)
// reads this instead of the render camera, so the third-person follow camera
// (Player.jsx, toggled with V) can sit behind the body without shifting where
// any of that logic thinks the player actually is. `y` is the jump-hop / ice-
// dip offset above ground (no eye height folded in) — PlayerAvatar.jsx uses it
// so the third-person body visually hops and dips the same as the first-person
// camera does. Player.jsx is the only writer.
export const playerBody = { x: 0, y: 0, z: 8 }
export const playerFacing = new THREE.Vector3(0, 0, -1)

export function resetPlayerBody() {
  playerBody.x = 0
  playerBody.y = 0
  playerBody.z = 8
  playerFacing.set(0, 0, -1)
}
