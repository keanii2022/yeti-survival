# Yeti Survival

A browser-based 3D survival-horror game, built for fun with my son one step at a
time. You're alone in a snowbound arena. Collect embers to stay warm, keep
moving, and don't let the yeti close the gap — it's slower than your sprint but
faster than your walk. Survive as long as you can and bank a high score.

## Stack

- **Vite + React** — app shell and build
- **@react-three/fiber** + **drei** — Three.js scene, camera, fog, environment
- **zustand** — game state (warmth, score, run status) kept outside the render loop
- **howler.js** — ambient audio and proximity stingers
- **@react-three/rapier** — in the toolset for collision work later

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL. Click to capture the mouse — **WASD** move,
**Shift** sprint, **Esc** release.

## Build progress

- [x] Snowy arena — ground, sky, fog, lighting
- [x] First-person movement + pointer-lock camera
- [x] Yeti with chase-detection AI
- [x] Embers, warmth meter, scoring, game-over screen
- [x] Atmosphere — snowfall, ambient audio, proximity stingers
- [ ] Step 6 — polish / stretch (see below)

## Step 6 — polish / stretch

Scoped from a playtest of steps 1–5. One session and one commit per item, with a
playtest between each — no batching two items into a session, no commit spanning
two items.

- **6.1 Stamina** — HUD stamina bar. Sprint (speed 10) drains it, walking/standing
  regenerates it, empty locks out sprint until it recovers past a threshold —
  empty means you're stuck at walk speed (6). Yeti chase speed is 5.4 normally
  and **bursts to 7 whenever it's within close range of the player**, independent
  of the player's stamina: proximity is always dangerous, and being caught close
  with an empty bar is how you die in the open.
- **6.2 Yeti spawn & wander randomization** — random spawn point each run (out
  past detection range, inside the arena); idle wander roams the whole arena on
  random waypoints instead of orbiting a fixed post.
- **6.3 Visible arena boundary** — a ring of mountains / a steep ridge so the edge
  reads before you walk into the invisible clamp and freeze there. Set dressing;
  the clamp still does the containment.
- **6.4 Adaptive audio** — calm, almost pleasant melodic bed while the yeti hasn't
  seen you; cut to aggressive strings / stingers on detection, ease off when it
  loses you. Driven by the existing `threat.mode` readout.
- **6.5 Scoring rework (step 4 follow-up)** — score becomes time survived (the
  headline number on the game-over screen) plus a flat bonus per ember; embers
  still top up warmth. This is the groundwork for 6.6: once embers respawn
  endlessly, "how long can you last" *is* the game.
- **6.6 Ember spawn randomization (A1)** *(needs 6.5)* — drop the fixed seed and
  the fixed count of six. Maintain a target number of active embers that keep
  spawning within a radius of the player but off-screen / at distance, never
  popping in on screen.
- **6.7 Green ember (A2)** *(needs 6.6)* — one at a time, spawns near the yeti,
  worth significantly more (points or a multiplier bump), visible from range so
  it's a deliberate risk. Inside its radius, pressing sprint gives an adrenaline
  boost (10 → ~11) — fast enough to beat the yeti's close-range 7 for the
  grab-and-run. Escape bonus for clearing the yeti's range with it in hand.
  Respawns near the yeti a while after it's taken.
- **6.8 Environment mood (B)** — more trees (instanced mesh past a few dozen);
  randomized time of day per run, slow drift from a random start weighted toward
  dusk (drei `<Sky>` / `<Stars>`). No full sun→stars cycle inside one run.
- **6.9 Tree collision (C)** — trees become solid via `@react-three/rapier`;
  player and yeti both collide with trunks. A physics collider, **not**
  pathfinding — the yeti stays dumb, it just can't clip through solid geometry.
  Crosses build steps, so check in before committing. Kinematic fallback if full
  physics is too invasive: the same radius push-out against nearby tree positions
  for both the player and the yeti.

6.6 and 6.7 depend on 6.5, in that order; 6.8 and 6.9 can slot in anywhere.

## v2 — parked

Explicit "not step 6" decisions:

- Streaming / infinite terrain
- Any yeti pathfinding or route-planning around obstacles
