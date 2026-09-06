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
6. Polish / stretch — playtest-scoped after steps 1–5. One session and one commit
   per sub-step; playtest between each; no batching. Full detail in the README's
   "Step 6" section; order of 6.6–6.9 is set by playtest, not fixed.

### Step 6 sub-steps

- **6.1 Stamina bar** — sprint drains it, walk regens, empty = stuck at walk
  speed; yeti chase speed bursts 5.4 → 7 when it's close, regardless of stamina.
- **6.2 Yeti spawn + wander randomization** — random spawn each run; wanders the
  whole arena instead of orbiting a fixed post.
- **6.3 Visible arena boundary** — mountains / ridge ring so the edge reads; the
  invisible clamp still does the containment.
- **6.4 Adaptive audio** — calm melodic bed while unseen, aggressive strings on
  detection, easing off when the yeti loses you.
- **6.5 Scoring rework** — score = time survived (headline) + a flat per-ember
  bonus; embers still top up warmth. Groundwork for 6.6.
- **6.6 Endless ember spawning** *(needs 6.5)* — drop the fixed seed and count of
  six; keep a target number of embers spawning near the player but off-screen.
- **6.7 Green ember** *(needs 6.6)* — one at a time near the yeti, worth much
  more; sprint inside its radius boosts 10 → ~11; escape bonus for getting clear.
- **6.8 Environment mood** — more trees (instanced past a few dozen); slow
  dusk-weighted time-of-day drift, no full day cycle per run.
- **6.9 Tree collision** — rapier colliders on trees for player and yeti. A
  collider, not pathfinding — the yeti stays dumb. Kinematic fallback: same
  radius push-out off nearby trees for both player and yeti. Crosses build
  steps; check in before committing.

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

## GitHub / remote
- Git identity must link every commit to the `keanii2022` GitHub account.
  Use name `Keani Antezana` and email
  `99574780+keanii2022@users.noreply.github.com` (GitHub's noreply address for
  that account). Do NOT use `keani.ga22@gmail.com` — it's verified on a
  different, throwaway account (`keaniarmand`) and mis-attributes commits.
  Never use the machine's auto-generated `<user>@<host>.local` address.
  Check with `git config user.email` before the first push on any machine.
- Remote is GitHub `origin`: https://github.com/keanii2022/yeti-survival
- Push `main` to `origin` after each completed build step, so the public
  history stays in sync with local progress.
- Never force-push `main` once it's on GitHub without asking first.
