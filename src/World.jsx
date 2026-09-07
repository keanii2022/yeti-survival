import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sky, Stars, Instances, Instance } from '@react-three/drei'
import { ARENA_HALF } from './Player.jsx'
import { generateTrees, TREE_COUNT } from './trees.js'
import { useGame } from './store.js'

// Small deterministic PRNG so the tree scatter is the same on every reload.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A single snow-capped peak: a broad rock cone with a smaller white cone on top.
// Low segment counts keep the far-off ring cheap; it's never seen up close.
function Peak({ position, radius, height, rotation }) {
  const capHeight = height * 0.32
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, height / 2, 0]}>
        <coneGeometry args={[radius, height, 6]} />
        <meshStandardMaterial color="#8a94a0" roughness={1} />
      </mesh>
      <mesh position={[0, height - capHeight / 2, 0]}>
        <coneGeometry args={[radius * 0.42, capHeight, 6]} />
        <meshStandardMaterial color="#eef4f8" roughness={1} />
      </mesh>
    </group>
  )
}

// A ring of mountains wrapping the arena so the edge reads before you walk into
// the invisible clamp at ARENA_HALF. Pure set dressing — no collision. Two
// concentric rows of the same cone peak: a front row with heavily overlapping
// bases, and an equally dense back row offset by half a step and set taller and
// further out. The offset lands a back peak behind every front valley, so the
// dips in the skyline stay (they're the look) but you never see sky or flat
// ground straight through a gap. Both rows scale their count with the 6.10
// arena so they don't tear open at the bigger radius.
function Mountains() {
  const peaks = useMemo(() => {
    const rand = mulberry32(41530207)
    const placed = []

    // `phase` shifts the whole row round the circle; `spreadJitter` is the
    // per-peak angular wobble, kept under the spacing so the row stays packed.
    const ring = (count, baseR, jitterR, minH, maxH, minRad, maxRad, spreadJitter, phase = 0) => {
      for (let i = 0; i < count; i++) {
        const angle =
          (i / count) * Math.PI * 2 + phase + (rand() - 0.5) * spreadJitter
        const r = baseR + (rand() - 0.5) * jitterR
        placed.push({
          position: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
          radius: minRad + rand() * (maxRad - minRad),
          height: minH + rand() * (maxH - minH),
          rotation: rand() * Math.PI * 2,
        })
      }
    }

    const FRONT = 52
    // Front massif: bases just past the clamp, heavily overlapping into a wall.
    ring(FRONT, ARENA_HALF + 6, 5, 15, 25, 8, 13, 0.3)
    // Back range: same count, offset half a step so a peak sits behind each
    // front gap; taller and further out, half-sunk in the fog so it looms.
    ring(FRONT, ARENA_HALF + 17, 8, 26, 42, 11, 17, 0.3, Math.PI / FRONT)

    return placed
  }, [])

  return peaks.map((p, i) => <Peak key={i} {...p} />)
}

// Scatter of pines across the arena interior — gives the open plane a sense of
// scale, cover to break line of sight behind, and something to navigate by.
// 6.10 widened the spread with the arena; 6.8 fills it in from a landmark
// handful to a proper sparse woodland. Each pine is three parts (trunk, body,
// snow cap) with distinct colours, so it's three InstancedMeshes sharing one
// transform per tree rather than a group per tree — a few draw calls for the
// whole stand. 6.9 moved the scatter into trees.js so the trunk colliders the
// player and yeti test against come from the same fixed-seed list.
function Trees() {
  const trees = useMemo(() => generateTrees(), [])

  // Each part's local vertical offset is baked into its geometry, so a single
  // uniform-scaled transform per tree reproduces the old nested-group layout.
  const [trunkGeo, bodyGeo, capGeo] = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1.2, 6)
    trunk.translate(0, 0.6, 0)
    const body = new THREE.ConeGeometry(1.1, 2.6, 7)
    body.translate(0, 2, 0)
    const cap = new THREE.ConeGeometry(0.7, 1.4, 7)
    cap.translate(0, 3, 0)
    return [trunk, body, cap]
  }, [])

  useEffect(
    () => () => [trunkGeo, bodyGeo, capGeo].forEach((g) => g.dispose()),
    [trunkGeo, bodyGeo, capGeo],
  )

  const transforms = trees.map((t, i) => (
    <Instance key={i} position={t.position} rotation={t.rotation} scale={t.scale} />
  ))

  return (
    <group>
      <Instances geometry={trunkGeo} limit={TREE_COUNT} range={trees.length} castShadow>
        <meshStandardMaterial color="#5b4636" roughness={1} />
        {transforms}
      </Instances>
      <Instances geometry={bodyGeo} limit={TREE_COUNT} range={trees.length} castShadow>
        <meshStandardMaterial color="#2f4a3d" roughness={1} />
        {transforms}
      </Instances>
      <Instances geometry={capGeo} limit={TREE_COUNT} range={trees.length} castShadow>
        <meshStandardMaterial color="#eef4f8" roughness={1} />
        {transforms}
      </Instances>
    </group>
  )
}

// --- Time of day -----------------------------------------------------------
// One run never sees a full sun-to-stars cycle. Instead each run rolls a start
// point on a single "afternoon -> deep night" dial (0 -> 1) and drifts slowly
// forward from there. The roll is weighted toward dusk, so most runs open in
// low amber light with the dark closing in; the far end of the dial is a
// dark-blue night with warm stars and a low moon.

const TOD_DRIFT = 0.0006 // dial units per second — ~+0.13 over a long run
const STAR_THRESHOLD = 0.72 // dusk deep enough for stars to read

// Sun heading, matched to the old key-light direction so shadows keep falling
// the way they did.
const AZ = Math.atan2(-6, 8)

// The moon hangs at a fixed spot on the far dome, high and roughly opposite the
// sunset glow. It doesn't track — it just watches.
const MOON_DIST = 280
const MOON_POS = (() => {
  const el = THREE.MathUtils.degToRad(52)
  const az = AZ + Math.PI * 0.78
  const h = Math.cos(el)
  return [Math.cos(az) * h * MOON_DIST, Math.sin(el) * MOON_DIST, Math.sin(az) * h * MOON_DIST]
})()

const _v = new THREE.Vector3()
const _c = new THREE.Color()

// fog / background walk: cold overcast -> warm dusk haze -> blue hour -> navy
const _FOG_STOPS = [
  [0.0, new THREE.Color('#c8d2dc')],
  [0.6, new THREE.Color('#c88a5f')],
  [0.82, new THREE.Color('#3a4a6b')],
  [1.0, new THREE.Color('#0b1836')],
]
// key light: cold daylight -> golden -> sunset -> blue moonlight
const _KEY_STOPS = [
  [0.0, new THREE.Color('#f2f6ff')],
  [0.5, new THREE.Color('#ffc98f')],
  [0.72, new THREE.Color('#ff8a4d')],
  [1.0, new THREE.Color('#9fc0ff')],
]
// hemisphere fill: bright and neutral by day, cool and blue deep at night
const _HEMI_SKY = [
  [0.0, new THREE.Color('#eaf1f7')],
  [0.75, new THREE.Color('#eaf1f7')],
  [1.0, new THREE.Color('#48597f')],
]
const _HEMI_GROUND = [
  [0.0, new THREE.Color('#9fb0bf')],
  [0.75, new THREE.Color('#9fb0bf')],
  [1.0, new THREE.Color('#2b3550')],
]

// Walk a [threshold, Color] stop list and lerp between the bracketing stops.
function walkStops(stops, u, out) {
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0] || i === stops.length - 1) {
      const [t0, c0] = stops[i - 1]
      const [t1, c1] = stops[i]
      return out.copy(c0).lerp(c1, THREE.MathUtils.clamp((u - t0) / (t1 - t0), 0, 1))
    }
  }
  return out.copy(stops[0][1])
}

// Clamped linear ramp: `a` at/below x0, `b` at/above x1.
const seg = (a, b, x, x0, x1) =>
  THREE.MathUtils.lerp(a, b, THREE.MathUtils.clamp((x - x0) / (x1 - x0), 0, 1))

// How "night" it is: 0 through dusk, ramping to 1 across the blue hour. Drives
// the moon, the star field and the blue cast on the fill light.
const nightAmount = (u) => THREE.MathUtils.clamp((u - 0.58) / 0.26, 0, 1)

// Unit sun direction for the given dial position; dips below the horizon past
// dusk so drei's <Sky> darkens on its own.
function sunDir(u, out) {
  const elev = THREE.MathUtils.degToRad(30 - u * 42)
  const h = Math.cos(elev)
  return out.set(Math.cos(AZ) * h, Math.sin(elev), Math.sin(AZ) * h)
}

// Roll this run's start on the dial. A normal run skews toward dusk — (1 - r*r)
// weights the roll to the top of a day-to-dusk band. Nightfall gets its own
// band up in the deep blue: it always opens with the moon and stars out, then
// drifts further into the dark. Kept out of render so the purity lint is happy
// (see Snow.jsx / Yeti.jsx for the same dance).
function rollDayStart(nightfall) {
  const r = Math.random()
  if (nightfall) return 0.8 + (1 - r * r) * 0.15
  return 0.3 + (1 - r * r) * 0.55
}

function dialParams(u) {
  return {
    rayleigh: seg(0.6, 3.2, u, 0.1, 0.72),
    turbidity: seg(8, 12, u, 0.1, 0.75),
    mieCoefficient: seg(0.005, 0.025, u, 0.2, 0.72),
    mieDirectionalG: seg(0.8, 0.94, u, 0.2, 0.75),
    keyIntensity: seg(1.15, 0.1, u, 0.15, 0.9),
    hemiIntensity: seg(0.95, 0.34, u, 0.2, 0.92),
    ambIntensity: seg(0.28, 0.08, u, 0.2, 0.92),
    fogNear: seg(12, 9, u, 0.3, 0.95),
    fogFar: seg(70, 46, u, 0.3, 0.95),
    night: nightAmount(u),
  }
}

function DayCycle() {
  const sky = useRef()
  const key = useRef()
  const moonLight = useRef()
  const hemi = useRef()
  const amb = useRef()
  const fog = useRef()
  const bg = useRef()
  const stars = useRef()
  const moon = useRef()
  const moonMat = useRef()
  const moonGlowMat = useRef()
  const elapsed = useRef(0)

  // Start of the dial for this run, rolled once on mount (the scene remounts
  // per run, so a fresh mount is a fresh run).
  const u0 = useMemo(() => rollDayStart(useGame.getState().nightfall), [])

  // Initial values for the first painted frame, before useFrame first runs.
  const init = useMemo(() => {
    const p = dialParams(u0)
    return {
      ...p,
      sun: sunDir(u0, new THREE.Vector3()).toArray(),
      keyColor: '#' + walkStops(_KEY_STOPS, u0, new THREE.Color()).getHexString(),
      fogColor: '#' + walkStops(_FOG_STOPS, u0, new THREE.Color()).getHexString(),
      starsVisible: u0 > STAR_THRESHOLD,
    }
  }, [u0])

  // Warm the star field to gold. drei's <Stars> has no colour prop, so paint
  // the per-point colour buffer directly after mount; they only ever show at
  // night, so no need to gate it on the dial.
  useEffect(() => {
    const pts = stars.current
    const attr = pts && pts.geometry.getAttribute('color')
    if (!attr) return
    const c = new THREE.Color()
    for (let i = 0; i < attr.count; i++) {
      c.setHSL(0.11 + Math.random() * 0.03, 0.5 + Math.random() * 0.3, 0.72 + Math.random() * 0.22)
      attr.setXYZ(i, c.r, c.g, c.b)
    }
    attr.needsUpdate = true
  }, [])

  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, 0.1)
    const u = Math.min(0.985, u0 + elapsed.current * TOD_DRIFT)
    const p = dialParams(u)

    if (sky.current) {
      const un = sky.current.material.uniforms
      un.sunPosition.value.copy(sunDir(u, _v))
      un.rayleigh.value = p.rayleigh
      un.turbidity.value = p.turbidity
      un.mieCoefficient.value = p.mieCoefficient
      un.mieDirectionalG.value = p.mieDirectionalG
    }
    if (key.current) {
      // Key light stays just above the horizon so late-run light never comes
      // from underground, even after the sky's sun has set.
      const le = THREE.MathUtils.degToRad(Math.max(30 - u * 42, 3))
      const lh = Math.cos(le)
      key.current.position.set(Math.cos(AZ) * lh * 40, Math.sin(le) * 40, Math.sin(AZ) * lh * 40)
      key.current.intensity = p.keyIntensity
      walkStops(_KEY_STOPS, u, key.current.color)
    }
    if (moonLight.current) moonLight.current.intensity = p.night * 0.3
    if (hemi.current) {
      hemi.current.intensity = p.hemiIntensity
      walkStops(_HEMI_SKY, u, hemi.current.color)
      walkStops(_HEMI_GROUND, u, hemi.current.groundColor)
    }
    if (amb.current) amb.current.intensity = p.ambIntensity

    walkStops(_FOG_STOPS, u, _c)
    if (fog.current) {
      fog.current.color.copy(_c)
      fog.current.near = p.fogNear
      fog.current.far = p.fogFar
    }
    if (bg.current) bg.current.copy(_c)

    if (stars.current) stars.current.visible = u > STAR_THRESHOLD
    if (moon.current) moon.current.visible = p.night > 0
    if (moonMat.current) moonMat.current.opacity = p.night
    if (moonGlowMat.current) moonGlowMat.current.opacity = p.night * 0.45
  })

  return (
    <>
      {/* Cold fog closes visibility down fast; both it and the clear colour
          behind it warm at dusk, then cool through blue hour to navy. */}
      <fog ref={fog} attach="fog" args={[init.fogColor, init.fogNear, init.fogFar]} />
      <color ref={bg} attach="background" args={[init.fogColor]} />

      <Sky
        ref={sky}
        sunPosition={init.sun}
        turbidity={init.turbidity}
        rayleigh={init.rayleigh}
        mieCoefficient={init.mieCoefficient}
        mieDirectionalG={init.mieDirectionalG}
      />
      <Stars
        ref={stars}
        visible={init.starsVisible}
        radius={140}
        depth={60}
        count={1500}
        factor={6}
        saturation={1}
        fade
        speed={0.6}
      />

      {/* Low moon on the far dome — a plain bright disc with a soft additive
          halo, both fading in across the blue hour. fog={false} so the tight
          night fog doesn't swallow it. */}
      <group ref={moon} position={MOON_POS} visible={init.night > 0}>
        <mesh>
          <sphereGeometry args={[7, 24, 24]} />
          <meshBasicMaterial
            ref={moonMat}
            color="#f6efd6"
            transparent
            opacity={init.night}
            fog={false}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[15, 20, 20]} />
          <meshBasicMaterial
            ref={moonGlowMat}
            color="#cfd8ff"
            transparent
            opacity={init.night * 0.45}
            fog={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Soft fill so nothing is pitch black, plus a low key for long shadows
          and a dim blue moon-side wash that only exists at night. */}
      <hemisphereLight ref={hemi} args={['#eaf1f7', '#9fb0bf', init.hemiIntensity]} />
      <ambientLight ref={amb} intensity={init.ambIntensity} />
      <directionalLight
        ref={key}
        position={init.sun.map((n) => n * 40)}
        intensity={init.keyIntensity}
        color={init.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight
        ref={moonLight}
        position={MOON_POS.map((n) => (n / MOON_DIST) * 60)}
        intensity={init.night * 0.3}
        color="#9fc0ff"
      />
    </>
  )
}

// The snowy world: ground, sky, drifting light, fog, mountains and trees.
export default function World() {
  return (
    <>
      <DayCycle />

      {/* Snowy ground plane — sized to run well past the boundary ring so the
          world doesn't visibly end behind the mountains at the new arena scale */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#eef4f8" roughness={1} metalness={0} />
      </mesh>

      <Mountains />
      <Trees />
    </>
  )
}
