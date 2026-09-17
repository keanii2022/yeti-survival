# Yeti Survival

A browser-based 3D survival-horror game, built for fun with my son one step at a
time. You're alone in a snowbound arena. Collect embers to stay warm, keep
moving, and don't let the yeti close the gap — it's slower than your sprint but
faster than your walk. Survive as long as you can and bank a high score.

**▶ Play it: [keanii2022.github.io/yeti-survival](https://keanii2022.github.io/yeti-survival/)**

## Stack

- **Vite + React** — app shell and build
- **@react-three/fiber** + **drei** — Three.js scene, camera, fog, environment
- **@react-three/rapier** — collision (trees, sheds, logs, the frozen pond)
- **zustand** — game state (warmth, score, run status) kept outside the render loop
- **howler.js** — ambient audio, adaptive music, proximity stingers

## Run it locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. Click to capture the mouse — **WASD** move,
**Shift** sprint, **1–4** use a carried item, **R** drop, **left-click** glance
behind, **Space** jump, **Esc** pause. Touch controls swap in automatically on
a phone or tablet; run `npm run dev -- --host` to reach it from one on the same
network.

## Tests

```bash
npm test          # run once
npm run test:watch
```

[Vitest](https://vitest.dev) + Testing Library, ~290 tests covering the
game-state store (warmth, stamina, scoring, the two ways a run ends), the AI
and physics helper modules, and input handling. The 3D scene itself is left to
playtesting.

## What's built

- A yeti with turn-rate-capped chase AI — cutting and juking actually opens a
  gap — plus search/investigate behavior when it loses line of sight
- A warmth + stamina survival loop, leveled runs with escalating difficulty,
  scoring, win/game-over screens, and Easy/Medium/Hard modes
- A 4-slot inventory of consumables and throwables (snack, blanket, decoy,
  flare, and more), plus footprints, hideable sheds, a frozen pond, a
  campfire, and weather events for hiding and misdirection
- Full mobile support — touch joystick, drag-look, on-screen buttons,
  responsive HUD, fullscreen/landscape lock
- Adaptive music and proximity audio

## Roadmap

Next up: a second yeti with a distinct "guardian" role patrolling a
high-value item, a roar/stun mechanic, daily seeds for comparing runs, and a
deeper endless "nightfall" mode. See [NOTES.md](NOTES.md) for the full build
log and design notes behind everything above.
