import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from './store.js'
import { effectiveLevel } from './levels.js'
import { guardian, guardianParams, resetGuardian, GUARDIAN_MIN_LEVEL } from './guardian.js'
import { ARENA_HALF } from './Player.jsx'
import { playerBody } from './playerBody.js'
import { YetiModel } from './YetiModel.jsx'
import { generateTrees, resolveTreeCollision } from './trees.js'
import { generateLogs, resolveLogCollision } from './logs.js'
import { generateSheds, resolveShedCollision } from './sheds.js'
import { generatePonds, resolvePondCollision } from './pond.js'
import { qualityFor } from './quality.js'
import { shelter } from './shelter.js'

// Step 8.3: the second yeti. Always mounted (so a level-up doesn't have to
// remount the scene), but a no-op — parked far below the world, publishing
// nothing — until effectiveLevel(level, nightfall) reaches GUARDIAN_MIN_LEVEL.
//
// Deliberately much simpler than the Hunter (Yeti.jsx): no search memory, no
// shed patrols, no feeding, no roar. Three states only —
//   'patrol': amble within `patrolRadius` of a fixed post, rolled once near
//             wherever the player happens to be the moment it activates.
//   'chase':  commit toward the player for up to `chaseCap` seconds — a hard
//             cap, not a lose-sight condition, per the "peels off" design.
//   'return': walk back to the post; a close re-approach on the way back can
//             still restart a chase, but distance alone never ends one early.
// GreenEmber.jsx anchors the ember on the post once `guardian.present` is
// true, which is the whole point: the ember becomes "the Guardian's turf."
const CATCH_RADIUS = 1.9
const GUARDIAN_RADIUS = 0.9 // body circle for the 6.9-style trunk/shed push-out
const ARRIVE_DIST = 1.8
const EDGE_MARGIN = 2
const POST_MIN_DIST = 20 // the post rolls this far from the player at activation...
const POST_MAX_DIST = 45 // ...to this far, so it never drops in on top of you
const COMMIT_DELAY = 0.3 // a beat shorter than the Hunter's L1 delay — he's already alert to his own turf
const LOSE_MARGIN = 6 // hysteresis on the aggro ring, same reasoning as the Hunter's loseRadius
const PATROL_SPEED = 1.6
const RETURN_SPEED_MULT = 0.75
const MAX_TURN_RATE = 2.4

const PALETTE = {
  legFur: '#aab4bd',
  torsoFur: '#c2ccd6',
  armFur: '#9aa4ad',
  headFur: '#ced8e0',
  eyeBase: '#001923',
  eyeGlow: '#29c7ff',
}

const PARKED_Y = -999 // out of the world entirely before activation

function randomPointNear(px, pz, minDist, maxDist, out) {
  const limit = ARENA_HALF - EDGE_MARGIN
  const ang = Math.random() * Math.PI * 2
  const r = minDist + Math.random() * (maxDist - minDist)
  out.set(
    THREE.MathUtils.clamp(px + Math.sin(ang) * r, -limit, limit),
    0,
    THREE.MathUtils.clamp(pz + Math.cos(ang) * r, -limit, limit),
  )
  return out
}

export default function Guardian() {
  const group = useRef()
  const isTouch = useGame((s) => s.isTouch)
  const eyeRef = useRef([null, null])

  const trees = useMemo(() => generateTrees(qualityFor(isTouch).treeCount), [isTouch])
  const logs = useMemo(() => generateLogs(), [])
  const sheds = useMemo(() => generateSheds(), [])
  const ponds = useMemo(() => generatePonds(), [])

  const g = useRef({
    active: false, // has the post been rolled and has he entered the world
    post: new THREE.Vector3(),
    mode: 'patrol', // 'patrol' | 'chase' | 'return'
    heading: 0,
    wander: new THREE.Vector3(),
    wanderTimer: 0,
    spotTimer: 0,
    chaseTimer: 0,
    curveLevel: 0,
    params: guardianParams(GUARDIAN_MIN_LEVEL),
  })

  const scratch = useMemo(
    () => ({
      toPlayer: new THREE.Vector3(),
      toTarget: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      hit: { x: 0, z: 0 },
    }),
    [],
  )

  useEffect(() => {
    resetGuardian()
    return () => resetGuardian()
  }, [])

  // One-time second chance (store.revivePlayer): same fairness the Hunter
  // gets — drop any active chase and settle back onto patrol so a revived
  // player doesn't spawn back into a Guardian still mid-pursuit.
  const reviveReq = useGame((s) => s.reviveReq)
  useEffect(() => {
    if (!reviveReq) return
    const gi = g.current
    if (!gi.active) return
    gi.mode = 'patrol'
    gi.spotTimer = 0
    gi.chaseTimer = 0
    gi.wanderTimer = 0
  }, [reviveReq])

  useFrame((_, rawDelta) => {
    if (useGame.getState().status !== 'playing') return
    const delta = Math.min(rawDelta, 0.1)
    const { level, nightfall, interlude } = useGame.getState()
    const curveLevel = effectiveLevel(level, nightfall)
    const gi = g.current
    const grp = group.current
    if (!grp) return

    if (curveLevel < GUARDIAN_MIN_LEVEL) {
      if (gi.active) {
        gi.active = false
        guardian.present = false
        grp.position.set(0, PARKED_Y, 0)
      }
      return
    }

    if (!gi.active) {
      // First activation this run: roll a post near wherever the player
      // currently is and drop him there, already patrolling.
      randomPointNear(playerBody.x, playerBody.z, POST_MIN_DIST, POST_MAX_DIST, gi.post)
      gi.wander.copy(gi.post)
      gi.mode = 'patrol'
      gi.spotTimer = 0
      gi.chaseTimer = 0
      gi.wanderTimer = 0
      gi.heading = Math.atan2(-gi.post.x, -gi.post.z)
      grp.position.set(gi.post.x, 0, gi.post.z)
      gi.active = true
    }

    if (curveLevel !== gi.curveLevel) {
      gi.curveLevel = curveLevel
      gi.params = guardianParams(curveLevel)
    }
    const P = gi.params

    const { toPlayer, toTarget, dir, hit } = scratch
    toPlayer.set(playerBody.x - grp.position.x, 0, playerBody.z - grp.position.z)
    const dist = toPlayer.length()
    const hidden = shelter.inside

    if (interlude) {
      // Calm breather, same as the Hunter: no aggression, just settle home.
      gi.mode = 'return'
      gi.spotTimer = 0
      gi.chaseTimer = 0
    } else if (gi.mode === 'patrol') {
      if (!hidden && dist < P.aggroRadius) {
        gi.spotTimer += delta
        if (gi.spotTimer >= COMMIT_DELAY) {
          gi.mode = 'chase'
          gi.spotTimer = 0
          gi.chaseTimer = P.chaseCap
        }
      } else {
        gi.spotTimer = 0
      }
    } else if (gi.mode === 'chase') {
      gi.chaseTimer -= delta
      if (hidden || dist > P.aggroRadius + LOSE_MARGIN || gi.chaseTimer <= 0) {
        gi.mode = 'return'
      }
    } else {
      // 'return': head for the post; still catchable and still able to
      // re-aggro on the way if you're right there, but distance from the
      // player never extends the trip — only reaching the post does.
      const dPost = Math.hypot(grp.position.x - gi.post.x, grp.position.z - gi.post.z)
      if (dPost < ARRIVE_DIST) {
        gi.mode = 'patrol'
        gi.wanderTimer = 0
      } else if (!hidden && dist < P.aggroRadius * 0.6) {
        gi.mode = 'chase'
        gi.chaseTimer = P.chaseCap
      }
    }

    guardian.mode = gi.mode
    guardian.distance = dist

    // Caught, same rule as the Hunter: never mid-interlude, never through a
    // shed wall.
    if (!interlude && !hidden && dist < CATCH_RADIUS) {
      useGame.getState().catchPlayer()
      return
    }

    let moving = false
    let speed = 0
    if (gi.mode === 'chase') {
      dir.copy(toPlayer).normalize()
      speed = P.speed
      moving = true
    } else if (gi.mode === 'return') {
      toTarget.set(gi.post.x - grp.position.x, 0, gi.post.z - grp.position.z)
      if (toTarget.lengthSq() > 1e-6) {
        dir.copy(toTarget).normalize()
        speed = P.speed * RETURN_SPEED_MULT
        moving = true
      }
    } else {
      // patrol: amble to a fresh point within patrolRadius of the post,
      // refreshing on arrival or every few seconds — same shape as the
      // Hunter's idle wander, just leashed tight to a fixed spot instead of
      // roaming off the player.
      gi.wanderTimer -= delta
      toTarget.set(gi.wander.x - grp.position.x, 0, gi.wander.z - grp.position.z)
      if (gi.wanderTimer <= 0 || toTarget.length() < 0.6) {
        const ang = Math.random() * Math.PI * 2
        const r = P.patrolRadius * Math.sqrt(Math.random())
        gi.wander.set(gi.post.x + Math.sin(ang) * r, 0, gi.post.z + Math.cos(ang) * r)
        gi.wanderTimer = 4 + Math.random() * 3
      } else {
        dir.copy(toTarget).normalize()
        speed = PATROL_SPEED
        moving = true
      }
    }

    if (moving) {
      const desired = Math.atan2(dir.x, dir.z)
      let turn = desired - gi.heading
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      gi.heading += THREE.MathUtils.clamp(turn, -MAX_TURN_RATE * delta, MAX_TURN_RATE * delta)
      grp.position.x += Math.sin(gi.heading) * speed * delta
      grp.position.z += Math.cos(gi.heading) * speed * delta
      resolveTreeCollision(trees, grp.position.x, grp.position.z, GUARDIAN_RADIUS, hit)
      resolveLogCollision(logs, hit.x, hit.z, GUARDIAN_RADIUS, hit)
      resolveShedCollision(sheds, hit.x, hit.z, GUARDIAN_RADIUS, hit)
      resolvePondCollision(ponds, hit.x, hit.z, GUARDIAN_RADIUS, hit)
      grp.position.x = THREE.MathUtils.clamp(hit.x, -ARENA_HALF, ARENA_HALF)
      grp.position.z = THREE.MathUtils.clamp(hit.z, -ARENA_HALF, ARENA_HALF)
    }

    let diff = gi.heading - grp.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    grp.rotation.y += diff * Math.min(delta * 12, 1)

    grp.position.y = moving ? Math.abs(Math.sin(performance.now() * 0.006)) * 0.12 : 0
    const glow = gi.mode === 'chase' ? 1.5 : gi.mode === 'return' ? 0.6 : 0.15
    for (const m of eyeRef.current) {
      if (m) m.emissiveIntensity += (glow - m.emissiveIntensity) * Math.min(delta * 6, 1)
    }

    guardian.present = true
    guardian.x = grp.position.x
    guardian.z = grp.position.z
  })

  return (
    <group ref={group} position={[0, PARKED_Y, 0]}>
      <YetiModel eyeRef={eyeRef} palette={PALETTE} />
    </group>
  )
}
