# Yeti Survival — Project Context

## What this is
A browser-based 3D survival horror game built for fun with my son. First or third person,
snowy environment, scary yeti(s) that chase the player. Collect items, survive as long as
possible, rack up a high score. Full-page standalone app — not tailored for anything else.

## Stack
- Vite + React
- @react-three/fiber (Three.js scene/rendering)
- @react-three/drei (camera controls, helpers, snow/fog effects)
- @react-three/rapier (physics/collision)
- zustand (game state: health, score, items collected)
- howler.js (ambient audio, stingers, footsteps)

## Core loop (v1 scope — build this first, nothing more)
- One small snowy arena
- Player movement + camera (WASD + mouse look)
- One yeti with basic chase AI (detects player within a radius, moves toward them,
  catching the player ends the run)
- 5–8 collectible items scattered in the arena, each adds to score
- A simple survival stat (e.g. warmth/stamina) that depletes over time
- Game-over screen showing final score

## Explicitly out of scope for v1 (do not build yet)
- Multiple yetis
- Yetis hiding behind trees / advanced AI behaviors
- Heavy dynamic snowfall / weather systems
- Persistent leaderboard
- Difficulty scaling
- Any UI embedding, robot-parts theming, or integration with other projects —
  this is a standalone game, full stop.

## Build order (one Claude Code session per step; use /clear between steps)
1. Empty 3D world — ground plane, sky, lighting, fog. Just prove it renders at localhost.
2. Player movement + camera controller.
3. One yeti with basic chase-detection AI.
4. Items + survival meter + scoring + game-over screen.
5. Atmosphere — snowfall particles, ambient/scary audio, proximity stingers.
6. Polish/stretch goals (only after the above feels fun to play).

## Working conventions
- Keep sessions scoped to one step above at a time.
- Test in the browser at localhost after every change before moving on.
- Prioritize "does this feel fun/scary" over visual polish in early steps.

## Git workflow
- Commit after every completed fix or feature — don't batch unrelated changes together.
- Write commit messages that tell the story of the project's progress, not just
  "update files." Describe what changed and why, e.g.:
  "Add yeti chase detection radius" not "wip" or "changes"
- Run `git status` and `git diff` before committing to confirm only the intended
  changes are staged.
- Never commit without asking first if a change touches more than one build step
  from the Build order section above.
