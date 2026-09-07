import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame, EMBER_SCORE, WARMTH_PER_EMBER } from './store.js'
import { levelTarget } from './levels.js'
import { ARENA_HALF } from './Player.jsx'

// Embers to collect. Walk over one to grab it — score, plus a small warmth
// top-up, so straying from safety toward the yeti is the price of staying warm.
// No physics; pickup is a plain distance check against the camera each frame.
const PICKUP_RADIUS = 2.6
const HOVER_HEIGHT = 0.9

// Step 6.6: the fixed, deterministic scatter of six is gone. Each level spawns
// its own wave of `levelTarget(level)` embers, and — from the playtest — they
// sit close and loosely in ONE direction rather than ringing the whole player.
// A level is a directed foray you can actually finish before you freeze, not a
// spiral search of the fog.
// The wave spans a broad wedge you have to work across — close enough that you
// commit to a heading, far enough (and spaced enough) that clearing it is a
// real forage, not a one-arc sweep. A straggler left in the fog is caught by
// the beacon falloff in the frame loop, so the field can be wide without the
// "found 7, can't find the 8th" freeze.
const SPAWN_MIN = 15
const SPAWN_MAX = 38
const WAVE_ARC = 2.2 // radians (~126°) the embers fan across their heading
const MIN_GAP_SQ = 36 // keep embers at least 6u apart

// One wave: N embers around (camera x,z), fanned across WAVE_ARC of a heading
// that points roughly toward the arena middle (which also keeps them off the
// walls). Best-effort — after `guard` tries the remaining slots fill on bounds
// alone so a level always has its full count.
function makeWave(camera, level) {
  const n = levelTarget(level)
  const cx = camera.position.x
  const cz = camera.position.z

  const fwd = new THREE.Vector3()
  camera.getWorldDirection(fwd)
  fwd.y = 0
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
  fwd.normalize()

  // Heading yaw uses the atan2(x, z) convention the yeti's movement code does.
  const towardCentre = Math.atan2(-cx, -cz)
  const heading = towardCentre + (Math.random() - 0.5) * Math.PI

  const edge = ARENA_HALF - 3
  const spots = []
  let guard = 0
  while (spots.length < n) {
    const strict = guard++ < 200
    const ang = heading + (Math.random() - 0.5) * WAVE_ARC
    const rad = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
    const x = cx + Math.sin(ang) * rad
    const z = cz + Math.cos(ang) * rad
    if (Math.abs(x) > edge || Math.abs(z) > edge) continue
    if (strict) {
      // nothing materialising dead ahead at close range
      const inv = 1 / Math.hypot(x - cx, z - cz)
      const dot = (x - cx) * inv * fwd.x + (z - cz) * inv * fwd.z
      if (dot > 0.7 && rad < 20) continue
      // keep them spread, not stacked
      if (spots.some((p) => (p[0] - x) ** 2 + (p[2] - z) ** 2 < MIN_GAP_SQ)) continue
    }
    spots.push([x, HOVER_HEIGHT, z])
  }
  return spots
}

// One level's wave. Remounted (via `key={level}` on the parent) whenever the
// level advances, so the spot roll and the collected flags reset with a plain
// useState initializer — no effect, no stale state to clear.
function EmberWave({ level }) {
  const { camera } = useThree()
  const groups = useRef([])
  const lights = useRef([])
  const orbs = useRef([])
  const [spots] = useState(() => makeWave(camera, level))
  const [collected, setCollected] = useState(() => spots.map(() => false))
  // Synchronous guard against double-counting: `collected` (React state) lags a
  // frame, so a slow walk over an ember keeps the loop seeing it as uncollected
  // for several frames. This ref flips the instant the pickup lands.
  const grabbed = useRef(new Set())

  useFrame((_, rawDelta) => {
    if (useGame.getState().status !== 'playing') return
    if (useGame.getState().interlude) return // wave already cleared; next one waits
    const delta = Math.min(rawDelta, 0.1)
    const t = performance.now() * 0.002

    // How many embers are still out there — the last one gets an extra beacon.
    let remaining = 0
    for (let i = 0; i < spots.length; i++) {
      if (!collected[i] && !grabbed.current.has(i)) remaining++
    }

    let justGrabbed = -1
    for (let i = 0; i < spots.length; i++) {
      if (collected[i] || grabbed.current.has(i)) continue

      const dx = camera.position.x - spots[i][0]
      const dz = camera.position.z - spots[i][2]
      const dist2 = dx * dx + dz * dz

      // Bob and spin so the embers catch the eye through the fog.
      const g = groups.current[i]
      if (g) {
        g.rotation.y += delta * 1.6
        g.position.y = HOVER_HEIGHT + Math.sin(t + i * 1.7) * 0.14
      }

      // Beacon falloff: the further an ember is from you, the harder it glows,
      // so a straggler left in the fog still reads instead of getting lost.
      // The final ember of a wave is boosted further — that's the one that was
      // freezing people on the bigger levels.
      let boost = Math.min(1, Math.max(0, (Math.sqrt(dist2) - 10) / 18))
      if (remaining === 1) boost = Math.min(1, boost + 0.55)
      const light = lights.current[i]
      if (light) {
        light.intensity = 9 + boost * 11
        light.distance = 13 + boost * 7
      }
      const orb = orbs.current[i]
      if (orb) orb.material.opacity = 0.14 + boost * 0.24

      if (dist2 < PICKUP_RADIUS * PICKUP_RADIUS) justGrabbed = i
    }

    // justGrabbed is always a fresh index — the loop skips anything in `grabbed`.
    if (justGrabbed >= 0) {
      grabbed.current.add(justGrabbed)
      setCollected((c) => {
        const next = c.slice()
        next[justGrabbed] = true
        return next
      })
      useGame.getState().collectItem(EMBER_SCORE, WARMTH_PER_EMBER)
    }
  })

  return spots.map((p, i) =>
    collected[i] ? null : (
      <group
        key={i}
        ref={(el) => (groups.current[i] = el)}
        position={[p[0], HOVER_HEIGHT, p[2]]}
      >
        <mesh castShadow>
          <icosahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial
            color="#ffce8a"
            emissive="#ff7a1a"
            emissiveIntensity={2.4}
            roughness={0.35}
            flatShading
          />
        </mesh>
        {/* Soft additive orb so the ember reads as a glow through the fog from
            range, not just a speck once the point light falls off. Opacity is
            driven per-frame by the beacon falloff above. */}
        <mesh ref={(el) => (orbs.current[i] = el)}>
          <sphereGeometry args={[1.15, 12, 12]} />
          <meshBasicMaterial
            color="#ff9a3c"
            transparent
            opacity={0.14}
            depthWrite={false}
          />
        </mesh>
        {/* Warm pool of light on the snow — no shadow, kept cheap. Intensity and
            reach are driven per-frame so a distant / last ember beacons. */}
        <pointLight
          ref={(el) => (lights.current[i] = el)}
          color="#ff9a3c"
          intensity={9}
          distance={13}
          decay={2}
        />
      </group>
    ),
  )
}

export default function Items() {
  const level = useGame((s) => s.level)
  return <EmberWave key={level} level={level} />
}
