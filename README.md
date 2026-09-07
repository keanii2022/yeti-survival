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

## Tests

```bash
npm test          # run once
npm run test:watch
```

[Vitest](https://vitest.dev) + Testing Library. The 3D scene is left to
playtesting; the suite covers the parts that break quietly — the game-state
store (warmth, stamina lockout, scoring, the two ways a run ends), the keyboard
input hook, and the HUD's state-driven rendering.

## Build progress

- [x] Snowy arena — ground, sky, fog, lighting
- [x] First-person movement + pointer-lock camera
- [x] Yeti with chase-detection AI
- [x] Embers, warmth meter, scoring, game-over screen
- [x] Atmosphere — snowfall, ambient audio, proximity stingers
- [ ] Step 6 — polish / stretch (see below)

## Step 6 — polish / stretch

Scoped from a playtest of steps 1–5, then reshaped part-way once the ember loop
started feeling like hide-and-seek — 6.5 onward is built around that. One session
and one commit per item, with a playtest between each — no batching two items
into a session, no commit spanning two items.

- **6.1 Stamina** — HUD stamina bar. Sprint (speed 10) drains it, walking/standing
  regenerates it, empty locks out sprint until it recovers past a threshold —
  empty means you're stuck at walk speed (6). Yeti chase speed is 5.4 normally
  and **bursts to 7 whenever it's within close range of the player**, independent
  of the player's stamina: proximity is always dangerous, and being caught close
  with an empty bar is how you die in the open. The 5.4 baseline and the 7 burst
  are level-1 values — 6.6 ramps both toward, but never to or past, sprint speed
  as levels climb.
- **6.2 Yeti spawn & wander randomization** — random spawn point each run (out
  past detection range, inside the arena); idle wander roams the whole arena on
  random waypoints instead of orbiting a fixed post.
- **6.3 Visible arena boundary** — a ring of mountains / a steep ridge so the edge
  reads before you walk into the invisible clamp and freeze there. Set dressing;
  the clamp still does the containment. Built at the current arena radius; 6.10
  grows the arena and this ring rescales with it.
- **6.4 Adaptive audio** — calm, almost pleasant melodic bed while the yeti hasn't
  seen you; cut to aggressive strings / stingers on detection, ease off when it
  loses you. Driven by the existing `threat.mode` readout. 6.6 stacks a darker
  stem per level on top of both beds.
- **6.5 Scoring rework (step 4 follow-up)** — the game-over screen leads with
  **level reached**, then time survived, then a flat bonus per ember (plus the
  green-ember bonuses from 6.7). Embers still top up warmth, but only a little —
  see 6.6. Groundwork for 6.6.
- **6.6 Levels / waves (A1)** *(needs 6.5, 6.10, 6.11)* — replaces the fixed seed
  and the fixed count of six. The run is a climb through discrete levels:
  - Each level = clear a target of ~6–8 embers, spawned within a radius of the
    player but off-screen / at distance, never popping in on screen.
  - Embers are **mostly score**. The warmth top-up is small — small enough that
    playing greedy or getting forced into detours still freezes you. Warmth stays
    a real death clock; the blanket (6.13) is the actual warmth lever.
  - Clear the target → ~8 s calm interlude (warmth paused, yeti pushed to far
    wander, music eases to the light bed, "LEVEL N" card) → the next level spawns
    and the yeti re-aggros. Each wave spawns close and fanned in one direction —
    a directed foray, not a search of the whole ring.
  - Escalation per level: L1–4, chase speed and detection radius creep up —
    running still works, the margin just shrinks. L5+, sustained chase speed
    holds just under sprint (≈9 vs 10; never at or above it) so you can't open a
    real gap by running straight, and the dial shifts to detection radius, faster
    commit-to-chase, longer last-known-position search (6.11), more frequent and
    faster shed checks (6.12), and tighter wander around the player. Past ~L5,
    surviving means breaking line of sight and using cover, not out-footing him.
  - LEVEL_COUNT levels to a "dawn breaks — you made it" win screen — 8, after a
    playtest walk from ~10 down to 6 (proved the loop) and back up to 8 (wanted
    more climb). Clearing them unlocks "nightfall": the same climb replayed, every
    level pinned NIGHTFALL_OFFSET rungs higher on the curve and capped at
    LEVEL_COUNT, with its own win screen. (Playtest change from the original
    "endless, no interludes" plan.) Nightfall still wants a proper pass —
    progressive escalation paired with the player getting more agile / new
    night-only consumables (water bottle, etc.) — but that's later, likely v3.
  - Audio: each level adds one darker stem on the 6.4 beds (drone → low strings →
    percussion pulse → dissonant lead); the interlude strips back to the light
    bed.
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
- **6.10 Bigger arena** — grow the play space so the yeti can genuinely lose you
  and hide-and-seek has room to happen. Still a fixed, finite arena — not
  streaming, not infinite (that's parked). Rescale the 6.3 boundary ring to the
  new radius, and any spawn / detection / wander distances tuned to the old size.
- **6.11 Yeti search & investigate state** — the AI groundwork the hide-and-seek
  steps share. On losing sight of the player the yeti doesn't instantly reset: it
  moves to the player's last-known position and searches nearby for a while
  before dropping back to wander. "Shaking him off" = break line of sight +
  change direction + stay unseen for ~4–6 s. Adds a generic "investigate this
  point" behaviour that 6.12 (shed checks) and 6.14 (decoy) reuse. Still not
  pathfinding — no route-planning around obstacles; the yeti just has a memory
  now.
- **6.12 Sheds** *(needs 6.11)* — a few enterable sheds. Inside: hidden from the
  yeti's detection, warmth drains slower (not zero). The yeti periodically walks
  over and checks the nearest shed — with a tell (approaching footfalls,
  breathing, the door rattling) so leaving is a fair panic moment, not a coin
  flip — then a cooldown before it checks the same one again. Hiding is a real
  trade: safe, but warmth still ticking and embers not being collected.
- **6.13 Snacks + blanket** — two rare consumables scattered like embers. Snack:
  press **E** to eat, locks stamina at full for a fixed window. Blanket: press
  **Q** to wrap up, warmth drains much slower for a fixed window. Both scarce
  enough to feel precious.
- **6.14 Decoy (throwable)** *(needs 6.11, pairs with 6.7)* — a throwable item the
  yeti diverts to investigate for a few seconds, hard-resetting an active chase.
  Rare. Spawns near the green ember, so the risky grab doubles as restocking your
  one panic button.

Dependency order: 6.5 → 6.10 → 6.11 → 6.6 → 6.7. 6.12 needs 6.11; 6.14 needs 6.11
and 6.7; 6.13 is standalone. 6.8 and 6.9 slot in anywhere. Within the
hide-and-seek group (6.10–6.14) the exact order is playtest-driven.

## v2 — parked

Explicit "not step 6" decisions:

- Streaming / infinite terrain
- Any yeti pathfinding or route-planning around obstacles
- Nightfall rework (later, ~v3): let the yeti keep escalating past the base-game
  peak instead of the current cap, paired with player counterplay that earns it
  — more agility and night-only consumables (water bottle, etc.). Until that
  exists as one design, nightfall stays the bounded capped replay it is now.
