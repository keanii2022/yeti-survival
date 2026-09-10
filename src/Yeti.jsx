import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import { levelParams, effectiveLevel } from './levels.js'
import { threat } from './threat.js'
import { ARENA_HALF } from './Player.jsx'
import { createProbe, beginProbe, stepProbe } from './investigate.js'
import { trailToFollow } from './footprints.js'
import { decoy } from './decoy.js'
import { generateTrees, resolveTreeCollision } from './trees.js'
import { qualityFor } from './quality.js'
import {
  generateSheds,
  resolveShedCollision,
  shedApproachPoint,
  nearestReadyShed,
} from './sheds.js'
import { shelter } from './shelter.js'

// Step 3: one yeti with basic chase-detection AI.
// Step 6.2: spawn point and idle wander are randomized per run.
// Step 6.11: a 'search' state sits between chase and idle — the yeti has a memory.
// Step 6.14: a 'decoy' state — a thrown decoy yanks him off anything, a live
// chase included, to go investigate where it landed (decoy.js drives it).
//
// Each run the yeti spawns somewhere random in the arena, always far enough
// from the player's start that no run begins already in a chase. It idles by
// roaming the whole arena on random waypoints until the player comes within
// DETECT_RADIUS. Then it locks on and walks straight at them until it gets
// within CATCH_RADIUS — which ends the run.
//
// Losing the player past LOSE_RADIUS (a bigger ring, so the state doesn't
// flicker at the boundary) no longer resets it straight to wander. Instead it
// drops into 'search': it stalks to the spot where it last saw you and casts
// around there for a few seconds (see investigate.js) before finally giving up.
// So a straight sprint away just leads it to your trail — to actually shake it
// you have to break line of sight, change direction, and stay unseen through
// the whole search (SEARCH_TIME plus however long the stalk takes).
//
// No pathfinding and no trees-as-cover yet; that's later in the build order.
// These numbers are tuned by feel, not physics: the chase is a touch slower
// than a walk (Player WALK_SPEED = 6) so backing away buys you a little time,
// but a sprint (10) clearly pulls ahead — until it gets within BURST_RADIUS,
// where it lunges at CHASE_BURST_SPEED (7). That's faster than a walk and
// independent of the player's stamina, so being cornered close is always deadly.
//
// 6.10 grew the arena to 120x120; a fixed-size sight range in a much larger pen
// is what lets a chase be broken by ducking into the fog. 6.6 turns the sight
// range, the chase speeds, the commit delay, the search time and the wander
// leash into a per-level curve — see levels.js. Only the numbers that don't
// escalate stay here.
const CATCH_RADIUS = 1.9
const BURST_RADIUS = 6 // inside this the chase switches to the lunge speed
// 6.14: seconds the yeti pokes around a thrown decoy once he reaches it. The
// walk over stacks on top, so the whole divert is longer than this — long
// enough to shake a chase if you cut away while he's still committed to it.
// Flat, not level-scaled: the deep-level pressure comes from how fast he
// re-commits afterwards, not from a shorter look.
const DECOY_LOOK_TIME = 3
// Body circle for the 6.9 trunk push-out. Wider than the player's — he's a
// brute — so he can't tuck fully behind a thin trunk, but still just a collider:
// he doesn't steer around trees, he bumps off them and keeps grinding forward.
const YETI_RADIUS = 0.9
const WANDER_SPEED = 1.6
const INTERLUDE_WANDER_SPEED = 3.2 // a touch quicker so he clears out visibly
const INTERLUDE_MIN_DIST = 52 // how far off the player his interlude waypoint sits
// 7.1: the yeti can't turn on a dime. Its heading — the direction it actually
// moves, not just the way the body faces — swings toward the target at this rate
// and no faster, so a hard cut by the player opens a gap he has to arc back from
// instead of him re-aiming straight at you every frame. Tighten if mid-chase
// juking still doesn't bite; the close-range lunge (BURST_RADIUS) may later want
// its own harder pivot so cornered-and-close stays deadly.
const MAX_TURN_RATE = 2.6 // radians/sec the yeti's heading can swing

// Detection range at level 1 — the ring randomSpawn() places the yeti outside.
// Deeper levels only widen it (levelParams.detectRadius), so a level-1 spawn is
// always a safe starting distance.
const DETECT_RADIUS = levelParams(1).detectRadius

const PLAYER_SPAWN = new THREE.Vector2(0, 8) // camera start (x, z) — see App.jsx
const EDGE_MARGIN = 2 // keep spawns and waypoints off the arena wall
// The yeti spawns in a ring around the player: past SPAWN_MIN_DIST so no run
// starts already in detection range, but inside SPAWN_MAX_DIST — only a short
// closing walk outside detection — so the first encounter comes quickly instead
// of you hiking across the 120x120 arena to find it.
const SPAWN_MIN_DIST = DETECT_RADIUS + 5
const SPAWN_MAX_DIST = DETECT_RADIUS + 16

// A point somewhere inside the arena, at least EDGE_MARGIN off every wall.
function randomArenaPoint(out) {
  const limit = ARENA_HALF - EDGE_MARGIN
  return out.set(
    (Math.random() * 2 - 1) * limit,
    0,
    (Math.random() * 2 - 1) * limit,
  )
}

// Pick the next idle waypoint. 6.6: the wander leash tightens with the level —
// at L1 `radius` spans the whole arena and this is just randomArenaPoint; deep
// levels pull the point to within `radius` of the player so the yeti lurks
// close. During the interlude it's forced the other way: a point well clear of
// the player so he visibly backs off while you catch your breath.
function pickWander(out, px, pz, radius, interlude) {
  const limit = ARENA_HALF - EDGE_MARGIN
  for (let i = 0; i < 24; i++) {
    if (interlude || radius >= 120) {
      randomArenaPoint(out)
    } else {
      const ang = Math.random() * Math.PI * 2
      const r = radius * Math.sqrt(Math.random())
      out.set(
        THREE.MathUtils.clamp(px + Math.cos(ang) * r, -limit, limit),
        0,
        THREE.MathUtils.clamp(pz + Math.sin(ang) * r, -limit, limit),
      )
    }
    const far = (out.x - px) ** 2 + (out.z - pz) ** 2 >= INTERLUDE_MIN_DIST ** 2
    if (!interlude || far) return out
  }
  return out
}

// A fresh spawn each run: a random arena point in the ring SPAWN_MIN_DIST..
// SPAWN_MAX_DIST from the player start.
function randomSpawn() {
  const p = new THREE.Vector3()
  for (let i = 0; i < 60; i++) {
    randomArenaPoint(p)
    const dx = p.x - PLAYER_SPAWN.x
    const dz = p.z - PLAYER_SPAWN.y
    const d2 = dx * dx + dz * dz
    if (d2 > SPAWN_MIN_DIST * SPAWN_MIN_DIST && d2 < SPAWN_MAX_DIST * SPAWN_MAX_DIST) break
  }
  return [p.x, 0, p.z]
}

// A shaggy white brute, built from primitives to match the tree style. Stands
// ~2.6m — taller than the player's 1.7m eye height, so it reads as looming.
// Modelled facing +Z so `rotation.y = atan2(dx, dz)` aims it at a target.
function YetiModel({ eyeRef }) {
  return (
    <group>
      {/* legs */}
      <mesh position={[-0.45, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 1.4, 6]} />
        <meshStandardMaterial color="#e9eef2" roughness={1} />
      </mesh>
      <mesh position={[0.45, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 1.4, 6]} />
        <meshStandardMaterial color="#e9eef2" roughness={1} />
      </mesh>

      {/* torso */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <capsuleGeometry args={[0.85, 1.1, 4, 10]} />
        <meshStandardMaterial color="#f2f6fa" roughness={1} />
      </mesh>

      {/* arms, hanging slightly forward */}
      <mesh position={[-1.0, 1.8, 0.15]} rotation={[0.3, 0, 0.15]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 1.5, 6]} />
        <meshStandardMaterial color="#e4eaef" roughness={1} />
      </mesh>
      <mesh position={[1.0, 1.8, 0.15]} rotation={[0.3, 0, -0.15]} castShadow>
        <cylinderGeometry args={[0.24, 0.2, 1.5, 6]} />
        <meshStandardMaterial color="#e4eaef" roughness={1} />
      </mesh>

      {/* head */}
      <mesh position={[0, 2.75, 0.05]} castShadow>
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#f6f9fc" roughness={1} flatShading />
      </mesh>

      {/* eyes — emissive so they can glow brighter the instant it spots you */}
      <mesh position={[-0.2, 2.82, 0.5]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial
          ref={(m) => (eyeRef.current[0] = m)}
          color="#2a0000"
          emissive="#ff2a1a"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0.2, 2.82, 0.5]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial
          ref={(m) => (eyeRef.current[1] = m)}
          color="#2a0000"
          emissive="#ff2a1a"
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  )
}

export default function Yeti() {
  const group = useRef()
  const { camera } = useThree()
  const isTouch = useGame((s) => s.isTouch)

  // Rolled once per mount; the scene remounts on every run (App keys on runId),
  // so this re-randomizes each time.
  const spawn = useMemo(() => randomSpawn(), [])

  // Trunk / shed colliders for this run — the same fixed-seed lists World.jsx
  // renders. Defined before the AI ref so the shed-check bookkeeping can size
  // itself to the shed count. 9.5: touch collides against the thinned stand.
  const trees = useMemo(
    () => generateTrees(qualityFor(isTouch).treeCount),
    [isTouch],
  )
  const sheds = useMemo(() => generateSheds(), [])

  // Per-frame state kept off React so the chase loop never triggers a re-render.
  const ai = useRef({
    mode: 'idle', // 'idle' | 'chase' | 'search' | 'shed' | 'decoy'
    heading: Math.atan2(-spawn[0], -spawn[2]), // movement yaw; starts facing arena centre
    wander: new THREE.Vector3(spawn[0], 0, spawn[2]), // current idle target
    wanderTimer: 0,
    spotTimer: 0, // seconds the player's been inside detection range (commit delay)
    curveLevel: 0, // effective level the params below were built for
    difficulty: null, // difficulty the params below were built for
    params: levelParams(1), // per-level curve, refreshed when the level / difficulty changes
    lastKnown: new THREE.Vector3(), // where the player was last seen (for 'search')
    probe: createProbe(), // drives the walk-to-a-spot-and-look-around motion
    // 6.12 shed checks: a countdown to the next patrol, a per-shed cooldown so
    // the same one isn't re-checked back to back, and the shed being checked now.
    shedCheckTimer: levelParams(1).shedCheckInterval,
    shedCooldowns: sheds.map(() => 0),
    shedTarget: -1,
    decoyId: 0, // the decoy.throwId he's already diverted for (6.14)
  })
  const eyeRef = useRef([null, null])

  // Reused every frame so the chase loop allocates nothing.
  const scratch = useMemo(
    () => ({
      toPlayer: new THREE.Vector3(),
      toWander: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      hit: { x: 0, z: 0 },
      door: { x: 0, z: 0 }, // reused target for a shed-check probe
    }),
    [],
  )

  // One-time second chance (store.revivePlayer): the scene stays mounted, so
  // pull the hunt right off the player. Drop every active behaviour, roll an
  // idle wander well clear of the spawn — the same "back off" the interlude
  // does — and teleport there, so the player respawns to a breath of room and
  // not a yeti two steps away.
  const reviveReq = useGame((s) => s.reviveReq)
  useEffect(() => {
    if (!reviveReq) return
    const a = ai.current
    a.mode = 'idle'
    a.spotTimer = 0
    a.wanderTimer = 0
    a.shedTarget = -1
    a.probe.active = false
    pickWander(a.wander, PLAYER_SPAWN.x, PLAYER_SPAWN.y, 999, true)
    a.lastKnown.copy(a.wander)
    a.heading = Math.atan2(-a.wander.x, -a.wander.z)
    if (group.current) group.current.position.set(a.wander.x, 0, a.wander.z)
  }, [reviveReq])

  useFrame((_, rawDelta) => {
    const g = group.current
    if (!g) return

    // Freeze completely once the run is over.
    if (useGame.getState().status !== 'playing') return

    const delta = Math.min(rawDelta, 0.1) // guard against tab-switch time jumps
    const a = ai.current
    const { toPlayer, toWander, dir, hit, door } = scratch

    // Refresh the per-level curve when the level advances (levels.js). Nightfall
    // shifts the whole run up the curve — effectiveLevel folds that in. Cached
    // on `a` so the frame loop still allocates nothing on a steady level.
    const { interlude, level, nightfall, difficulty } = useGame.getState()
    const curveLevel = effectiveLevel(level, nightfall)
    if (curveLevel !== a.curveLevel || difficulty !== a.difficulty) {
      a.curveLevel = curveLevel
      a.difficulty = difficulty
      a.params = levelParams(curveLevel, difficulty)
    }
    const P = a.params

    // Horizontal vector from yeti to player.
    toPlayer.set(
      camera.position.x - g.position.x,
      0,
      camera.position.z - g.position.z,
    )
    const dist = toPlayer.length()

    // 6.12: inside a shed the player is off the yeti's radar entirely — the
    // walls cut line of sight, so he can't acquire and can't hold a chase.
    const hidden = shelter.inside

    // --- detection state machine (with hysteresis) ---
    // Keep the last-known fix current for as long as it can actually see you.
    if (a.mode === 'chase') a.lastKnown.set(camera.position.x, 0, camera.position.z)

    // Shed cooldowns recover whenever the run is live and not in the breather —
    // even mid-chase. The patrol clock itself only ticks while he's calm (idle
    // branch below).
    if (!interlude) {
      for (let i = 0; i < a.shedCooldowns.length; i++) {
        if (a.shedCooldowns[i] > 0) a.shedCooldowns[i] -= delta
      }
    }

    // 6.14: a freshly thrown decoy trumps every other state, a live chase
    // included — he breaks off and stalks to where it landed, then pokes around
    // it (same probe as the 6.11 last-known search / the 6.12 shed check). One
    // divert per throw: latch the id so he doesn't re-trigger every frame it's
    // still on the ground. Never mid-interlude — he's already been sent wide.
    if (!interlude && decoy.live && decoy.throwId !== a.decoyId) {
      a.decoyId = decoy.throwId
      beginProbe(a.probe, decoy.x, decoy.z, DECOY_LOOK_TIME)
      a.mode = 'decoy'
      a.spotTimer = 0
      a.shedTarget = -1
    }

    if (interlude) {
      // Calm breather: drop everything and back off to a far wander. No
      // re-aggro until the next level spawns.
      if (a.mode !== 'idle') {
        a.mode = 'idle'
        a.probe.active = false
        a.wanderTimer = 0
      }
      a.spotTimer = 0
      a.shedTarget = -1
      a.shedCheckTimer = P.shedCheckInterval
      decoy.live = false // a decoy thrown right before the breather is spent
    } else if (a.mode === 'chase') {
      // Lost sight — over the lose ring, or he ducked into a shed. Don't reset;
      // go hunt where they were last seen (or the shed door they vanished into).
      if (hidden && shelter.shedIndex >= 0) {
        // You ducked into a shed mid-chase — run it as a shed check, not a full
        // last-known search: he heads to the door, holds it only for the short
        // shedLookTime, then that shed goes on cooldown (the 'shed' r.done
        // handler) so a lost chase into a shed doesn't become a 10-second
        // siege or an endless patrol back and forth.
        shedApproachPoint(sheds[shelter.shedIndex], door)
        beginProbe(a.probe, door.x, door.z, P.shedLookTime)
        a.shedTarget = shelter.shedIndex
        a.mode = 'shed'
      } else if (dist > P.loseRadius) {
        // 7.3: hand the probe the footprint trail from here to the last-known
        // spot so he tracks along where you actually ran instead of teleporting
        // his attention there. Empty (you crossed hard ground, or he lost you
        // point-blank) → he beelines the last-known spot exactly as before.
        beginProbe(
          a.probe,
          a.lastKnown.x,
          a.lastKnown.z,
          P.searchTime,
          trailToFollow(g.position.x, g.position.z),
        )
        a.mode = 'search'
      }
    } else if (a.mode === 'search') {
      if (!hidden && dist < P.reacquireRadius) {
        a.probe.active = false // reacquired — straight back to the chase
        a.mode = 'chase'
      }
    } else if (a.mode === 'decoy') {
      // Diverted to the decoy. He only snaps back onto you once he's actually
      // reached it (probe in its 'look' phase) AND you're close — while he's
      // still stalking over he's fully committed, and that's the head start the
      // throw is for. Same tight reacquire ring as a shaken search.
      if (!hidden && a.probe.phase === 'look' && dist < P.reacquireRadius) {
        a.probe.active = false
        a.mode = 'chase'
        a.spotTimer = 0
        decoy.live = false
      }
    } else if (a.mode === 'shed') {
      // Mid shed-check: the player breaking cover close by still yanks him into
      // a chase, on the same commit delay as an idle spot.
      if (!hidden && dist < P.detectRadius) {
        a.spotTimer += delta
        if (a.spotTimer >= P.commitDelay) {
          a.probe.active = false
          a.mode = 'chase'
          a.spotTimer = 0
          a.shedTarget = -1
        }
      } else {
        a.spotTimer = 0
      }
    } else {
      // idle. Commit delay: the player has to sit inside detection range for
      // P.commitDelay seconds before the chase locks on — long enough at L1 to
      // dart across his sightline, gone by the deep levels.
      if (!hidden && dist < P.detectRadius) {
        a.spotTimer += delta
        if (a.spotTimer >= P.commitDelay) {
          a.mode = 'chase'
          a.spotTimer = 0
        }
      } else {
        a.spotTimer = 0
        // Nothing doing — count down to the next shed patrol. When it fires,
        // stalk over to the nearest ready shed that's within reach.
        a.shedCheckTimer -= delta
        if (a.shedCheckTimer <= 0) {
          const idx = nearestReadyShed(
            sheds,
            g.position.x,
            g.position.z,
            a.shedCooldowns,
          )
          if (idx >= 0) {
            const dx = sheds[idx].x - g.position.x
            const dz = sheds[idx].z - g.position.z
            if (dx * dx + dz * dz < 42 * 42) {
              shedApproachPoint(sheds[idx], door)
              beginProbe(a.probe, door.x, door.z, P.shedLookTime)
              a.shedTarget = idx
              a.mode = 'shed'
            }
          }
          a.shedCheckTimer = P.shedCheckInterval
        }
      }
    }

    // Publish the readout the audio engine / vignette poll each frame. 6.7 adds
    // the yeti's position so the green ember can spawn close to it.
    threat.distance = dist
    threat.mode = a.mode
    threat.yetiX = g.position.x
    threat.yetiZ = g.position.z

    // 6.12: publish how close the yeti is to the shed that matters, so Sound.jsx
    // can pace the door-knock tell and the HUD can flip to "he's at the door".
    // Priority is the shed the PLAYER is hiding in whenever they're hidden — so
    // the tell fires whether he tracked you there in a chase, is searching the
    // door, or wandered over on a patrol check — falling back to the shed he's
    // actively checking otherwise.
    if (hidden && shelter.shedIndex >= 0) {
      const st = sheds[shelter.shedIndex]
      shelter.yetiCheckIndex = shelter.shedIndex
      shelter.yetiCheckDist = Math.hypot(g.position.x - st.x, g.position.z - st.z)
    } else if (a.mode === 'shed' && a.shedTarget >= 0) {
      const st = sheds[a.shedTarget]
      shelter.yetiCheckIndex = a.shedTarget
      shelter.yetiCheckDist = Math.hypot(g.position.x - st.x, g.position.z - st.z)
    } else {
      shelter.yetiCheckIndex = -1
      shelter.yetiCheckDist = Infinity
    }

    // --- caught? --- (never mid-interlude, and never while you're safe inside
    // a shed — he can't grab what he can't see through the wall)
    if (!interlude && !hidden && dist < CATCH_RADIUS) {
      useGame.getState().catchPlayer()
      return
    }

    // --- pick a movement direction for this frame (unit vector in `dir`) ---
    let moving = false
    let speed = 0

    if (a.mode === 'chase') {
      dir.copy(toPlayer).normalize()
      speed = dist < BURST_RADIUS ? P.burstSpeed : P.chaseSpeed
      moving = true
    } else if (a.mode === 'search' || a.mode === 'shed' || a.mode === 'decoy') {
      // Same motion for all three: stalk to the point (last-known spot, a shed
      // door, or a thrown decoy), cast around it, then give up — see
      // investigate.js. Keep the pokes off the arena wall like the waypoints.
      const r = stepProbe(a.probe, g.position, delta, { bound: ARENA_HALF - EDGE_MARGIN })
      if (r.done) {
        if (a.mode === 'shed' && a.shedTarget >= 0) {
          // Checked it — don't come straight back to this one.
          a.shedCooldowns[a.shedTarget] = P.shedCheckInterval * 1.5
          a.shedTarget = -1
        }
        if (a.mode === 'decoy') decoy.live = false // done with it
        a.mode = 'idle'
        a.wanderTimer = 0 // pick a fresh waypoint next frame
      } else {
        dir.set(r.aimX - g.position.x, 0, r.aimZ - g.position.z)
        if (dir.lengthSq() > 1e-6) {
          dir.normalize()
          speed = r.speed
          moving = true
        }
      }
    } else {
      // Idle wander: amble toward a waypoint, refreshing it on arrival or every
      // several seconds. The leash tightens with the level (pickWander /
      // P.wanderRadius) — arena-wide at L1, lurking close by the deep levels —
      // and the interlude forces it wide the other way, well off the player.
      a.wanderTimer -= delta
      toWander.set(a.wander.x - g.position.x, 0, a.wander.z - g.position.z)
      if (a.wanderTimer <= 0 || toWander.length() < 0.6) {
        pickWander(a.wander, camera.position.x, camera.position.z, P.wanderRadius, interlude)
        a.wanderTimer = 5 + Math.random() * 4
      } else {
        dir.copy(toWander).normalize()
        speed = interlude ? INTERLUDE_WANDER_SPEED : WANDER_SPEED
        moving = true
      }
    }

    // --- turn toward the target, then step forward along the heading ---
    // 7.1: movement follows `a.heading`, and the heading only swings toward the
    // target at MAX_TURN_RATE. `dir` is where he *wants* to go; the capped turn
    // is why a sharp cut by the player actually opens a gap instead of him
    // tracking your exact position frame to frame.
    if (moving) {
      const desired = Math.atan2(dir.x, dir.z)
      let turn = desired - a.heading
      turn = Math.atan2(Math.sin(turn), Math.cos(turn)) // shortest way round
      a.heading += THREE.MathUtils.clamp(turn, -MAX_TURN_RATE * delta, MAX_TURN_RATE * delta)

      g.position.x += Math.sin(a.heading) * speed * delta
      g.position.z += Math.cos(a.heading) * speed * delta
      // Shove back out of any trunk he walked into (6.9), then clamp to the
      // arena. The trunk just stops him passing through — it doesn't redirect
      // him — which is what makes trees usable as cover.
      resolveTreeCollision(trees, g.position.x, g.position.z, YETI_RADIUS, hit)
      resolveShedCollision(sheds, hit.x, hit.z, YETI_RADIUS, hit)
      g.position.x = THREE.MathUtils.clamp(hit.x, -ARENA_HALF, ARENA_HALF)
      g.position.z = THREE.MathUtils.clamp(hit.z, -ARENA_HALF, ARENA_HALF)
    }

    // Body faces the way he's moving. `a.heading` is already rate-limited, so
    // just chase it directly — a touch of smoothing to soak up any snap when the
    // mode changes.
    let diff = a.heading - g.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    g.rotation.y += diff * Math.min(delta * 12, 1)

    // Menacing bob while moving; eyes flare when locked on.
    g.position.y = moving ? Math.abs(Math.sin(performance.now() * 0.006)) * 0.12 : 0
    const glow =
      a.mode === 'chase'
        ? 1.6
        : a.mode === 'search' || a.mode === 'shed' || a.mode === 'decoy'
          ? 0.7
          : 0.15
    for (const m of eyeRef.current) {
      if (m) m.emissiveIntensity += (glow - m.emissiveIntensity) * Math.min(delta * 6, 1)
    }
  })

  return (
    <group ref={group} position={spawn}>
      <YetiModel eyeRef={eyeRef} />
    </group>
  )
}
