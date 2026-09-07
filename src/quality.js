// Step 9.5 — mobile performance tier.
//
// The desktop scene is too heavy for a phone GPU to hold 60fps: an uncapped
// devicePixelRatio on a 3x panel is ~9x the fragment work, 220 shadow-casting
// instanced pines get redrawn into a 2048² shadow map every frame, and the snow
// is 1500 live points swayed on the CPU. On a coarse-pointer device every piece
// of the scene reads its budget from here instead. Desktop keeps exactly the
// values it had before this step — `qualityFor(false)` is the old hard-coded
// scene.
//
// These numbers are a sane starting point, not a measurement: the README wants
// them tuned against a real phone's framerate, so a follow-up playtest pass is
// expected to move them.

import { TREE_COUNT } from './trees.js'

const DESKTOP = {
  maxDpr: 2, // matches @react-three/fiber's default dpr={[1, 2]}
  shadows: true, // <Canvas shadows> → PCFSoftShadowMap
  shadowMapSize: 2048, // key-light directional shadow map
  treeCount: TREE_COUNT, // 220 — render list and collider list both
  treeShadows: true, // pines cast into the shadow map
  snowCount: 1500, // falling-flake points
}

const MOBILE = {
  maxDpr: 1.5, // a hard clamp — most phones report 2–3
  shadows: 'basic', // BasicShadowMap: hard-edged but the cheapest path. The
  //                   yeti still casts his own shadow (his approach tell).
  shadowMapSize: 1024,
  treeCount: 130, // a strict prefix of the 220 (same fixed seed), so the
  //                thinned stand still matches its colliders 1:1
  treeShadows: false, // pines stop casting; the ground keeps the key-light
  //                    shadow, so the yeti reads against it as before
  snowCount: 650,
}

// The scene-quality budget for this device. `isTouch` is the store's latched
// coarse-pointer flag (App.jsx / touch.js).
export function qualityFor(isTouch) {
  return isTouch ? MOBILE : DESKTOP
}
