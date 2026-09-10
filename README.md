# Yeti Survival

A browser-based 3D survival-horror game, built for fun with my son one step at a
time. You're alone in a snowbound arena. Collect embers to stay warm, keep
moving, and don't let the yeti close the gap — it's slower than your sprint but
faster than your walk. Survive as long as you can and bank a high score.

**▶ Play it: [keanii2022.github.io/yeti-survival](https://keanii2022.github.io/yeti-survival/)**

## Stack

- **Vite + React** — app shell and build
- **@react-three/fiber** + **drei** — Three.js scene, camera, fog, environment
- **zustand** — game state (warmth, score, run status) kept outside the render loop
- **howler.js** — ambient audio and proximity stingers
- **@react-three/rapier** — in the toolset for collision work later

## Run it

The live build is at
**[keanii2022.github.io/yeti-survival](https://keanii2022.github.io/yeti-survival/)**,
redeployed on every push to `main`. To run it locally:

```bash
npm install
npm run dev
```

Open the printed localhost URL. Click to capture the mouse — **WASD** move,
**Shift** sprint, **L** glance behind, **E** / **Q** snack / blanket, **F**
decoy, **Esc** release. Run `npm run dev -- --host` to reach it from a phone on
the same network.

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
- [x] Step 6 — polish / stretch (6.1–6.14)
- [ ] Step 7 — chase-fair, inventory, controls, world (see below)
- [ ] Step 8 — AI escalation & replay (see below)
- [x] Step 9 — Mobile / touch (9.1–9.6) — pulled forward ahead of Step 7's remainder (see below)

Deployed to [GitHub Pages](https://keanii2022.github.io/yeti-survival/); every
push to `main` redeploys.

## Difficulty modes

Added off the build order after playtests where phone players kept stalling at
level 2 — the game had only ever had one setting. **Easy / Medium / Hard**,
chosen on the start screen or any game-over card and remembered across reloads
(`localStorage`), default **Medium**.

`hard` is the original, fully-playtested curve — its mods are all identity, so
that path is unchanged. `medium` and `easy` scale four levers down (`difficulty.js`):
warmth drain (`Survival.jsx`), and the yeti's chase/lunge speed, detection range
and commit delay (`levelParams` in `levels.js`, read live by `Yeti.jsx`).
Ember targets, the wander leash, shed checks and the search window are the same
in all three.

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
  - LEVEL_COUNT levels to a "dawn breaks — you made it" win screen — **6**, after
    a playtest walk ~10 → 6 → 8 → 6: eight had two levels the family playtest was
    never reaching (stalling around L2–3), so the win line is back at a climb that
    can actually be finished. The escalation curve is untouched; only where the
    run ends moved. Clearing them unlocks "nightfall": the same climb replayed,
    every level pinned NIGHTFALL_OFFSET rungs higher on the curve and capped at
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

## Step 7 — chase-fair, inventory, controls, world

Scoped from the post–Step-6 brainstorm in `docs/v2-backlog.md`, redlined then
folded here. Same discipline as Step 6: one session and one commit per item, a
playtest between each, no batching, push after each.

The through-line: Step 6 gave the yeti a memory, but the chase is still unfair —
it re-aims at your exact position every frame, so juking does nothing. 7.1–7.3
fix that; the rest builds the hide-and-seek toolkit on top.

- [x] **7.1 Yeti max turn rate** — a hard cap on how fast the yeti's heading
  changes. A 90° cut now opens a gap it has to arc back from, so a chase reads as
  a chase. Prerequisite for the whole group; hiding / juking / decoys all feel
  unfair without it.
- [x] **7.2 Mirror / look-behind** — the camera glances behind you, the view
  frosts over after ~1–2 s, on a cooldown so it can't be held open as a mirror.
  The coarse feedback that makes 7.1 legible — you cut, then check. Stays outside
  the hint system: no yeti bearing on the HUD, ever. (7.4's controls pass moved
  the trigger from **L** to a left mouse-click.)
- [x] **7.3 Footprints** — the player leaves tracks in snow. An investigating
  yeti (6.11) follows them toward your last-known instead of teleporting its
  attention there. Tracks fade over time; hard ground — shed floor now, pond ice
  and rock later — leaves none. Adds the surface-type hook 7.13 and 7.15 reuse.
- [x] **7.4 Inventory** — 4 generic carried slots. Pick an item into whatever
  slot is free, not one key per type. Full inventory → drop one (stays in the
  world, found via 7.5) to pick another. Migrates snack / blanket / decoy onto
  this system and retires their 6.13 E/Q bindings. Using an item may briefly lock
  you to walk speed.
  - _Shipped control map_ (playtest-revised three times): carried items always
    pack left with no gaps (store `compact`), so **1–4** always line up with the
    chips and use that item; **Q** is a shorthand for "1"; **R** drops your first
    item (while playing — R is still restart on a game-over card). Touch: tap a
    slot button to use, long-press to drop. The dropped scheme before this — "E
    cycles a hidden selection, R drops the selected one" — missed constantly:
    with a gap in the slots "press 1" hit nothing, and R dropped whichever item
    the invisible cursor was on, not the one you meant. (And before that, "E
    cycles / hold-E drops", pulled for the same class of reason.)
- [x] **7.5 Dropped-item hint pip** — a fuzzy HUD direction pip, no distance,
  back toward anything you've dropped. Mainly for the blanket (7.6); applies to
  any dropped slot item.
- [x] **7.6 Placeable blanket** — the blanket becomes placeable: set it down,
  warmth drains slower while you stand on it, 7.5 points you back to it.
- [ ] **7.7 Snack / water-bottle merge** — snack stays the **day** version (locks
  stamina at full for a window). Water bottle is the **night** version: locked
  stamina + a small speed boost. Same slot; time of day picks which spawns.
- [ ] **7.8 Throwables — duck & poop** — both reuse 6.11's investigate-a-point.
  Squeaky duck: loud squeak on landing, a short snappy lure. Poop: squish on
  landing, the yeti walks over, sniffs, recoils, leaves — a longer window than
  the duck, no repeat interest. Ship both; the humour is the point for playing
  with a kid.
- [ ] **7.9 Flare (throwable)** — lights an area and makes the yeti avoid that
  zone for a while — area denial, the inverse of the duck. Doubles as vision
  through fog / dusk. Rare.
- [ ] **7.10 Pause** — **Esc** opens a pause menu and releases the mouse in one
  press (the browser drops pointer-lock on the first Esc, so a two-press design
  isn't reliable). Click **Resume** to re-lock. (Space-to-pause exists today; the
  Esc menu doesn't.)
- [ ] **7.11 Sprint rebind** — move sprint off the pinky. A variant shipped in
  7.4's controls pass — sprint is **double-tap-and-hold W**, Shift kept as an
  alias — but the intended **Mouse4** (thumb-button) bind is still open. The
  toggle / fixed-burst model stays parked pending this playtest.
- [ ] **7.12 Jump** — **Space**, with its own small bar so it can't be spammed.
  Low obstacles (logs): the player hops them, the yeti has no jump and a wider
  collision so it detours around. Pairs with the 6.9 tree colliders; the yeti
  stays dumb.
- [ ] **7.13 Frozen pond** — fast to cross, but **cracks if you sprint** across:
  falling in is a big warmth hit plus ~1 s immobilised. The yeti avoids the ice
  and detours. A shortcut with a risk. Ice counts as hard ground for 7.3.
- [ ] **7.14 Campfire** — stand in the radius for warmth regen, but **while lit
  your detection range balloons**. A direct risk / reward on the core stat.
- [ ] **7.15 Shed extension** — entering a shed **unseen** is still safe (6.12).
  Entering **while chased**: the yeti waits outside a few seconds, then loses
  interest — it can't open the door. Shed floor is hard ground: no footprints
  (7.3).
- [ ] **7.16 Weather events** — discrete events, not a system. Wind gust:
  directional, accelerates warmth drain when you move into it, readable in the
  snow particles. Sleet: cuts vision for a window.

**Groups and order:**

- **Chase-fair (7.1–7.3):** 7.1 before 7.2 — the mirror is pointless until a cut
  actually opens a gap. 7.3 has no code dependency on 7.1/7.2; it's grouped here
  as the third piece of making the hunt feel fair. Each ships and is playtested
  on its own, then playtest 7.1–7.3 together as the "does the chase read as a
  chase now" gate before moving on.
- **Inventory + consumables (7.4–7.9):** 7.4 first — 7.5, 7.7, 7.8 and 7.9 all
  need a slot to exist. Then 7.5 before 7.6 (the pip points you back to the
  placed blanket).
- **Control-map cleanup (7.10–7.12):** independent of everything else in Step 7;
  placed after the inventory group by choice, to get slots in sooner.
- **World mechanics (7.13–7.16):** 7.13 and 7.15 use the hard-ground /
  surface-type hook from 7.3 (no prints on ice or shed floor); 7.14 and 7.16
  stand alone.

Within a group the exact order is playtest-driven, like 6.10–6.14.

## Step 8 — AI escalation & replay

Split out of the Step 7 backlog because it's the biggest design risk and wants
everything in Step 7 — plus a full father-and-son playtest of it — settled first.
Same one-item-per-commit discipline.

- **8.1 Distracted feeding** — the yeti occasionally stops to feed, fully blind
  for a few seconds. Spawns near a level's **final** ember cluster, so the last
  pickups of each level are the tensest.
- **8.2 Roar / stun** — a telegraphed roar. If the player is in the yeti's
  sightline when it lands: a brief slow + screen shake. Punishes standing still
  in the open.
- **8.3 Two yetis — Hunter + Guardian (from L5)** — the Hunter hunts constantly,
  ramping on the existing 6.6 dial. The Guardian has a job: it patrols the green
  ember (6.7) on its **own** ramp track — tighter patrol radius, wider aggro, and
  at high levels it peels off to chase briefly before returning to post. Net at
  L5+: one chaser plus one guarded high-value zone, not two chasers. Reframes 6.7
  as "raid the Guardian's turf while the Hunter is still on you."
- **8.4 Daily seed** — one fixed seed per calendar day, so two people can compare
  scores on the same layout. No persistent leaderboard.
- **8.5 Per-level modifiers** — occasional twist levels: blizzard (vision cut),
  blackout (no HUD), double embers. Cheap variety on top of the linear ramp.
- **8.6 Nightfall rework** *(needs 8.3)* — replaces the current capped-replay
  nightfall. Both yetis always present, shorter calm interludes, escalation that
  keeps going; score is how far you get. This is the "let the yeti climb past the
  base-game peak, paired with counterplay that earns it" design the old v2 note
  parked — Step 7's agility tools (jump, mirror, night consumables) are that
  counterplay.

## Step 9 — Mobile / touch

Pulled forward ahead of Step 7's remainder: the game is deployed and I want it
playable on a phone for playtesting with my son. Desktop keyboard/mouse stays the
default and is left untouched — the touch layer is swapped in on a coarse-pointer
device. Same discipline as Steps 6–8: one session and one commit per item, a
playtest between each, push after each. Order within the step is playtest-driven,
like 6.10–6.14.

- **9.1 Touch detection + drag-look** — coarse-pointer detection swaps in the
  touch UI. Drag anywhere on the right half of the screen to look; no
  pointer-lock (iOS Safari can't do it). The keyboard/mouse path is unchanged.
- **9.2 Movement joystick** — a left-thumb zone maps touch offset to a move
  vector. Drag past a radius threshold to latch sprint; pull back inside it to
  release. Replaces WASD + Shift on touch.
- **9.3 On-screen action buttons** — **L** (glance behind), **E** / **Q** (snack
  / blanket), **F** (decoy) as thumb-reachable tap targets, clear of the joystick
  and look zones.
- **9.4 Responsive HUD + full-bleed threat vignette** — the HUD scales to a small
  landscape screen; the "he sees you" red wraps the whole viewport instead of a
  fixed inset.
- **9.5 Mobile performance tier** — on touch devices: clamp devicePixelRatio,
  thin the instanced trees and the snow density, cheaper or fewer shadows. Tuned
  against the framerate on a real phone, not a guess.
- **9.6 Landscape + fullscreen** — a rotate-to-landscape nudge, fullscreen on
  first tap, and an add-to-home-screen manifest for a chromeless launch.

## Parked

Explicitly not in Steps 6–9:

- Streaming / infinite terrain
- Any yeti pathfinding or route-planning around obstacles
- Deep snow drifts + snowshoes — a pair; snowshoes only matter if drifts exist,
  so revisit together
- Scent-vs-sight detection modes — found confusing in the brainstorm; night mode
  already carries the "scarier detection" job
- Sprint toggle / fixed-burst rework — revisit after the 7.11 Mouse4 rebind
  playtest
- Mirror as a physical held item, vs the 7.2 base L-key glance
