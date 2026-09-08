import { useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import {
  drops,
  addDrop,
  removeDrop,
  resetDrops,
  screenBearing,
  fuzzBearing,
  nearestDrop,
} from './drops.js'
import { hasFreeSlot } from './inventory.js'
import { inControl } from './touch.js'

// Step 7.5: dropped items in the world, plus the data behind the HUD hint pip.
//
//  - A hold-E drop (App.jsx) / long-press (TouchControls) clears a slot and
//    bumps `dropReq`; the subscription here catches that edge and marks the
//    ground a step in front of the player — the camera position only exists
//    inside the Canvas, so this is where it has to happen.
//  - Every frame it writes `drops.bearing`: the fuzzy (8-sector) heading from
//    where you're facing to the nearest drop, which Hud's DropPip polls. No
//    distance is ever published — the pip is "that way", not a range-finder.
//  - Walk back over a drop with a slot free and it re-pockets (grabItem), same
//    as any other pickup. That's the whole point of the pip: a dropped item is
//    findable now, so hold-E is safe to bind.
//
// Deliberately low-key visuals — a small dim box + a faint glow, no fog-immune
// beacon. The pip does the "where"; the marker only has to be recognisable once
// you're close.

const PICKUP_RADIUS = 2.2
const REST_Y = 0.42
const DROP_AHEAD = 1.4 // metres in front of your feet, so you don't re-grab it mid-stride

// Muted takes on each item's pickup colour.
const TINT = { snack: '#c98f52', blanket: '#6f88c8', decoy: '#a074f0' }

export default function Drops() {
  const { camera } = useThree()
  const [, bump] = useState(0) // re-render the marker list on a drop / re-pickup
  const fwd = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    resetDrops()
    let seen = useGame.getState().dropReq
    const unsub = useGame.subscribe((s) => {
      if (s.dropReq === seen) return
      seen = s.dropReq
      if (!s.pendingDrop || s.status !== 'playing') return
      camera.getWorldDirection(fwd)
      fwd.y = 0
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
      fwd.normalize()
      addDrop(
        s.pendingDrop,
        camera.position.x + fwd.x * DROP_AHEAD,
        camera.position.z + fwd.z * DROP_AHEAD,
      )
      bump((n) => n + 1)
    })
    return () => {
      unsub()
      resetDrops()
    }
  }, [camera, fwd])

  useFrame(() => {
    if (!drops.list.length) {
      drops.bearing = null
      return
    }

    const near = nearestDrop(camera.position.x, camera.position.z)
    camera.getWorldDirection(fwd)
    drops.bearing = fuzzBearing(
      screenBearing(
        fwd.x,
        fwd.z,
        near.x - camera.position.x,
        near.z - camera.position.z,
      ),
    )

    // Walk-over re-pickup — only while you're actually in control and have room.
    const { status, interlude, isTouch, slots } = useGame.getState()
    if (status !== 'playing' || interlude || !inControl(isTouch)) return
    if (!hasFreeSlot(slots)) return
    const dx = camera.position.x - near.x
    const dz = camera.position.z - near.z
    if (dx * dx + dz * dz > PICKUP_RADIUS * PICKUP_RADIUS) return
    useGame.getState().grabItem(near.kind)
    removeDrop(near)
    bump((n) => n + 1)
  })

  return (
    <>
      {drops.list.map((e, i) => {
        const tint = TINT[e.kind] || '#9fb2c8'
        return (
          <group key={e.id} position={[e.x, REST_Y, e.z]} rotation={[0, i * 1.1, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.44, 0.16, 0.32]} />
              <meshStandardMaterial
                color={tint}
                emissive={tint}
                emissiveIntensity={0.3}
                roughness={0.85}
                flatShading
              />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <sphereGeometry args={[0.62, 10, 10]} />
              <meshBasicMaterial
                color={tint}
                transparent
                opacity={0.16}
                depthWrite={false}
                fog={false}
              />
            </mesh>
            <pointLight color={tint} intensity={3.5} distance={7} decay={2} />
          </group>
        )
      })}
    </>
  )
}
