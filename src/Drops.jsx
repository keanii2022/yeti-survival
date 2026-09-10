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
  blanketUnderfoot,
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
// Step 7.6: a blanket spent with Q comes through the same handoff flagged
// `placed`. A placed entry is laid flat at your feet, never auto-re-pocketed
// (you want to stand on it), still pointed at by the pip, and — while you're
// within BLANKET_RADIUS of one — flips the store's `blanketActive` so the
// warmth drain eases for as long as you hold the spot.
//
// Deliberately low-key visuals — a small dim box + a faint glow, no fog-immune
// beacon. The pip does the "where"; the marker only has to be recognisable once
// you're close.

const PICKUP_RADIUS = 2.2
const REST_Y = 0.42
const DROP_AHEAD = 1.4 // metres in front of your feet, so you don't re-grab it mid-stride
const PLACE_AHEAD = 0.5 // a set-down blanket lands right under you — you're meant to stand on it
const BLANKET_RADIUS = 1.8 // how close counts as "on the blanket" for the eased drain

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
      const ahead = s.pendingDropPlaced ? PLACE_AHEAD : DROP_AHEAD
      addDrop(
        s.pendingDrop,
        camera.position.x + fwd.x * ahead,
        camera.position.z + fwd.z * ahead,
        s.pendingDropPlaced,
      )
      bump((n) => n + 1)
    })
    return () => {
      unsub()
      resetDrops()
      useGame.getState().setOnBlanket(false)
    }
  }, [camera, fwd])

  useFrame(() => {
    if (!drops.list.length) {
      drops.bearing = null
      if (drops.onBlanket) {
        drops.onBlanket = false
        useGame.getState().setOnBlanket(false)
      }
      return
    }

    const px = camera.position.x
    const pz = camera.position.z

    // The pip points at the nearest drop of any kind — including a set-down
    // blanket, so it doubles as "walk back to your blanket".
    const near = nearestDrop(px, pz)
    camera.getWorldDirection(fwd)
    drops.bearing = fuzzBearing(
      screenBearing(fwd.x, fwd.z, near.x - px, near.z - pz),
    )

    // 7.6: eased warmth drain while you're stood on a placed blanket. A little
    // hysteresis on the radius keeps the edge from chattering the flag (and its
    // audio cue), and it's only a set() on an actual change.
    const r = drops.onBlanket ? BLANKET_RADIUS + 0.4 : BLANKET_RADIUS
    const on = blanketUnderfoot(px, pz, r)
    if (on !== drops.onBlanket) {
      drops.onBlanket = on
      useGame.getState().setOnBlanket(on)
    }

    // Walk-over re-pickup — only while you're actually in control and have room.
    // A placed blanket is excluded: you stand on it, you don't hoover it up.
    const { status, interlude, isTouch, slots } = useGame.getState()
    if (status !== 'playing' || interlude || !inControl(isTouch)) return
    if (!hasFreeSlot(slots)) return
    const grab = nearestDrop(px, pz, (e) => !e.placed)
    if (!grab) return
    const dx = px - grab.x
    const dz = pz - grab.z
    if (dx * dx + dz * dz > PICKUP_RADIUS * PICKUP_RADIUS) return
    useGame.getState().grabItem(grab.kind)
    removeDrop(grab)
    bump((n) => n + 1)
  })

  return (
    <>
      {drops.list.map((e, i) => {
        const tint = TINT[e.kind] || '#9fb2c8'
        if (e.placed) {
          // A blanket set down (7.6): a wide flat fold pressed into the snow, a
          // low warm glow that reads as "shelter" once you're close. No bob, no
          // beacon — the pip brings you back to it.
          return (
            <group key={e.id} position={[e.x, 0.06, e.z]} rotation={[0, i * 0.7, 0]}>
              <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.7, 1.3]} />
                <meshStandardMaterial
                  color={tint}
                  emissive={tint}
                  emissiveIntensity={0.35}
                  roughness={0.95}
                  side={THREE.DoubleSide}
                  flatShading
                />
              </mesh>
              {/* a slight rumpled ridge so it isn't a flat decal */}
              <mesh position={[0.15, 0.07, -0.1]} rotation={[0, 0.5, 0.1]}>
                <boxGeometry args={[1.2, 0.12, 0.5]} />
                <meshStandardMaterial
                  color={tint}
                  emissive={tint}
                  emissiveIntensity={0.3}
                  roughness={0.95}
                  flatShading
                />
              </mesh>
              <pointLight
                color={tint}
                intensity={2.4}
                distance={6}
                decay={2}
                position={[0, 0.6, 0]}
              />
            </group>
          )
        }
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
