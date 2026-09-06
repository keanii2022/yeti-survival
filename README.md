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
- [ ] Atmosphere — snowfall, ambient audio, stingers
- [ ] Polish
