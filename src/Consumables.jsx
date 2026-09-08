import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame, SNACK_SECONDS, BLANKET_SECONDS } from './store.js'
import { generateTrees, resolveTreeCollision } from './trees.js'
import { generateSheds, resolveShedCollision } from './sheds.js'
import { inControl } from './touch.js'
import { hasFreeSlot } from './inventory.js'
import { ARENA_HALF } from './arena.js'

// Step 6.13: the two rare consumables — a snack and a blanket. Both scatter like
// embers but far scarcer: up to two of each loose in the arena at a time (on
// staggered fuses so they don't refresh in lockstep), a long cooldown after a
// grab before that slot refills, and you still only carry one of a kind at once
// — a second pickup just sits until a slot frees up. Walk over one to pocket it
// (store: grabItem drops it in the first free V/B/N/M slot); trigger it by hand
// later with that slot's key (App.jsx / 7.4). The effects live in the store
// (snackActive pins stamina) and Survival.jsx (blanketActive slows the drain);
// this file just spawns the pickups and counts the two windows down.
//
// No physics — a plain distance check to the camera each frame, same as
// Items.jsx. Not tied to the yeti or a level, so they ride through the interlude
// untouched; only the spawn fuse and the active windows pause with the run.

const PICKUP_RADIUS = 2.4
const HOVER_HEIGHT = 1.0

// seconds — first appearance, then the wait after each grab. Long on purpose:
// finding one should feel like luck, not a resupply run. The blanket lags the
// snack so they don't tend to sit out together.
const SPAWN = {
  snack: { first: 18, respawn: 70 },
  blanket: { first: 30, respawn: 82 },
}

// The second pickup of a kind runs this many seconds behind the first, on both
// its opening fuse and every refill, so the pair never appears or refreshes at
// the same moment.
const SLOT_STAGGER = 22

// Where it drops: a band out from the *player*, same idea as the ember waves —
// far enough to be a trek, close enough that you can pick a heading and get
// there. An absolute-arena roll (what this was) buried it across 120u of fog.
const SPAWN_MIN = 22
const SPAWN_MAX = 48

// The mountain ring (World.jsx) has no collider and its innermost peaks reach in
// to ~48u from the origin, so a spot near the arena clamp lands buried in rock.
// Keep every pickup inside this radius — comfortably clear of the peaks, and a
// touch more central so it's easier to stumble on.
const SPAWN_MAX_RADIUS = ARENA_HALF - 16

// If it's sat unclaimed this long and the player has wandered well clear of it
// (past the fog, so the move never pops on screen), re-roll it near wherever the
// player is now — a bad opening heading shouldn't strand it for the whole run.
const RELOCATE_AFTER = 32
const RELOCATE_MIN_DIST = 62

// Distinct silhouettes so a glance tells them apart through the murk: the snack
// a small upright ration bar in warm amber, the blanket a wide flat fold in
// cold blue.
const LOOK = {
  snack: {
    box: [0.5, 0.3, 0.2],
    color: '#d89a52',
    emissive: '#4a2a0c',
    glow: '#ffbe80',
    light: '#ffb066',
  },
  blanket: {
    box: [0.74, 0.18, 0.5],
    color: '#6f88c8',
    emissive: '#1c2c52',
    glow: '#a9c8ff',
    light: '#9fbcff',
  },
}

// One pickup: rolls a spot, waits out its fuse, mounts the mesh, and hands off
// to the store on walk-over. `kind` is 'snack' | 'blanket'; `slot` (0 | 1) just
// staggers this instance's timers off the other one of its kind.
function Pickup({ kind, slot }) {
  const { camera } = useThree()
  const mesh = useRef()
  const glow = useRef()
  const beam = useRef()
  const trees = useMemo(() => generateTrees(), [])
  const sheds = useMemo(() => generateSheds(), [])
  const hit = useMemo(() => ({ x: 0, z: 0 }), [])

  const phase = useRef('waiting') // 'waiting' = counting to spawn, 'active' = out there
  const fuse = useRef(SPAWN[kind].first + slot * SLOT_STAGGER)
  const age = useRef(0) // seconds this active pickup has gone unclaimed
  const [spot, setSpot] = useState(null) // [x, z] once active

  // A point in a band out from the player, pulled inside the mountain ring and
  // nudged clear of any tree trunk or shed wall so it never lands stuck in
  // geometry.
  const rollSpot = () => {
    const ang = Math.random() * Math.PI * 2
    const rad = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
    const x = camera.position.x + Math.sin(ang) * rad
    const z = camera.position.z + Math.cos(ang) * rad
    resolveTreeCollision(trees, x, z, 0.6, hit)
    resolveShedCollision(sheds, hit.x, hit.z, 0.6, hit)
    // Radial clamp (not per-axis) so the corners can't poke into the peaks.
    const r = Math.hypot(hit.x, hit.z)
    if (r > SPAWN_MAX_RADIUS) {
      const k = SPAWN_MAX_RADIUS / r
      return [hit.x * k, hit.z * k]
    }
    return [hit.x, hit.z]
  }

  useFrame((_, rawDelta) => {
    const { status, interlude, isTouch } = useGame.getState()
    if (status !== 'playing') return
    const delta = Math.min(rawDelta, 0.1)

    if (phase.current === 'waiting') {
      // Don't burn the fuse on the start prompt or a pause.
      if (!inControl(isTouch)) return
      fuse.current -= delta
      if (fuse.current <= 0) {
        setSpot(rollSpot())
        age.current = 0
        phase.current = 'active'
      }
      return
    }

    // --- active ---
    if (!spot) return // state lag: phase flipped, mesh not mounted yet
    age.current += delta

    const dx = camera.position.x - spot[0]
    const dz = camera.position.z - spot[1]
    const pdist = Math.hypot(dx, dz)

    // Stranded across the arena and forgotten — quietly move it back into reach.
    if (age.current > RELOCATE_AFTER && pdist > RELOCATE_MIN_DIST) {
      setSpot(rollSpot())
      age.current = 0
      return
    }

    const t = performance.now() * 0.002
    const g = mesh.current
    if (g) {
      g.rotation.y += delta * 1.1
      g.position.y = HOVER_HEIGHT + Math.sin(t + (kind === 'snack' ? 0 : 1.6)) * 0.12
    }
    // Brighten with distance so it still reads through the fog from across the
    // arena — the glow orb and a fog-immune shaft above it, same trick the green
    // ember uses. Rarer than an ember, but you shouldn't need to trip over it.
    const far = THREE.MathUtils.clamp((pdist - 14) / 44, 0, 1)
    if (glow.current) glow.current.material.opacity = 0.18 + far * 0.22
    if (beam.current) beam.current.material.opacity = 0.06 + far * 0.16

    if (dx * dx + dz * dz > PICKUP_RADIUS * PICKUP_RADIUS) return

    // In range. Pocket it only if a slot's free — otherwise it sits and waits.
    // 7.4: duplicates are fine, so no "already carrying this kind" check.
    if (interlude || !hasFreeSlot(useGame.getState().slots)) return
    useGame.getState().grabItem(kind)
    phase.current = 'waiting'
    fuse.current = SPAWN[kind].respawn + slot * SLOT_STAGGER
    setSpot(null)
  })

  if (!spot) return null
  const look = LOOK[kind]
  return (
    <group ref={mesh} position={[spot[0], HOVER_HEIGHT, spot[1]]}>
      <mesh castShadow>
        <boxGeometry args={look.box} />
        <meshStandardMaterial
          color={look.color}
          emissive={look.emissive}
          emissiveIntensity={0.8}
          roughness={0.7}
          flatShading
        />
      </mesh>
      <mesh ref={glow}>
        <sphereGeometry args={[0.85, 12, 12]} />
        <meshBasicMaterial
          color={look.glow}
          transparent
          opacity={0.18}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      {/* Soft fog-immune shaft — the part you can pick out from range. Opacity
          is driven per-frame by the distance brighten above. */}
      <mesh ref={beam} position={[0, 7, 0]}>
        <cylinderGeometry args={[0.22, 0.44, 14, 8, 1, true]} />
        <meshBasicMaterial
          color={look.glow}
          transparent
          opacity={0.06}
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight color={look.light} intensity={8} distance={15} decay={2} />
    </group>
  )
}

export default function Consumables() {
  // The two active windows. Seeded on the rising edge of each *Active flag and
  // burned down while the player's in control (paused / interlude / start-screen
  // frames don't count against them). At zero, hand back to the store.
  const snackWin = useRef(0)
  const blanketWin = useRef(0)
  const wasSnack = useRef(false)
  const wasBlanket = useRef(false)

  useEffect(() => {
    snackWin.current = 0
    blanketWin.current = 0
    wasSnack.current = false
    wasBlanket.current = false
  }, [])

  useFrame((_, rawDelta) => {
    const {
      status,
      interlude,
      isTouch,
      snackActive,
      blanketActive,
      endSnack,
      endBlanket,
    } = useGame.getState()

    if (snackActive && !wasSnack.current) snackWin.current = SNACK_SECONDS
    wasSnack.current = snackActive
    if (blanketActive && !wasBlanket.current) blanketWin.current = BLANKET_SECONDS
    wasBlanket.current = blanketActive

    if (status !== 'playing' || interlude || !inControl(isTouch)) return
    const delta = Math.min(rawDelta, 0.1)

    if (snackActive) {
      snackWin.current -= delta
      if (snackWin.current <= 0) endSnack()
    }
    if (blanketActive) {
      blanketWin.current -= delta
      if (blanketWin.current <= 0) endBlanket()
    }
  })

  return (
    <>
      <Pickup kind="snack" slot={0} />
      <Pickup kind="snack" slot={1} />
      <Pickup kind="blanket" slot={0} />
      <Pickup kind="blanket" slot={1} />
    </>
  )
}
