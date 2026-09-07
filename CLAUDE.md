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
   "Step 6" section; order within the 6.10–6.14 hide-and-seek group is set by
   playtest, not fixed.
7. Chase-fair + toolkit — fix the linear chase (yeti turn-rate cap → look-behind
   mirror → footprints), then the inventory / consumables system, control-map
   cleanup, and world mechanics (frozen pond, campfire, shed extension, weather
   events). Same one-session / one-commit / one-playtest / no-batching rule.
   Full detail in the README's "Step 7" section.
8. AI escalation & replay — distracted feeding, roar / stun, two yetis (Hunter +
   Guardian), daily seed, per-level modifiers, nightfall rework. Needs Step 7
   shipped and fully playtested first. Full detail in the README's "Step 8"
   section.

### Step 6 sub-steps

- **6.1 Stamina bar** — sprint drains it, walk regens, empty = stuck at walk
  speed; yeti chase speed bursts 5.4 → 7 when it's close, regardless of stamina.
  5.4 and 7 are level-1 values; 6.6 ramps both toward but never past sprint speed.
- **6.2 Yeti spawn + wander randomization** — random spawn each run; wanders the
  whole arena instead of orbiting a fixed post.
- **6.3 Visible arena boundary** — mountains / ridge ring so the edge reads; the
  invisible clamp still does the containment. Rescales with 6.10.
- **6.4 Adaptive audio** — calm melodic bed while unseen, aggressive strings on
  detection, easing off when the yeti loses you. 6.6 stacks a darker stem per
  level.
- **6.5 Scoring rework** — game-over screen leads with level reached, then time
  survived, then a flat per-ember bonus; embers still top up warmth (only a
  little). Groundwork for 6.6.
- **6.6 Levels / waves** *(needs 6.5, 6.10, 6.11)* — replaces the fixed seed +
  count of six. The run is a climb through ~10 levels; each = clear ~6–8
  off-screen embers, then a ~12 s calm interlude, then the next. Embers are
  mostly score, tiny warmth top-up. Escalation: L1–4 speed + detection radius
  creep; L5+ speed caps just under sprint (≈9 vs 10) and the dial moves to
  detection, faster chase commit, longer last-known search, faster shed checks,
  tighter wander — past ~L5 you must break line of sight, not outrun. Clear 10 →
  win screen; unlocks an endless "nightfall" mode.
- **6.7 Green ember** *(needs 6.6)* — one at a time near the yeti, worth much
  more; sprint inside its radius boosts 10 → ~11; escape bonus for getting clear.
- **6.8 Environment mood** — more trees (instanced past a few dozen); slow
  dusk-weighted time-of-day drift, no full day cycle per run.
- **6.9 Tree collision** — rapier colliders on trees for player and yeti. A
  collider, not pathfinding — the yeti stays dumb. Kinematic fallback: same
  radius push-out off nearby trees for both player and yeti. Crosses build
  steps; check in before committing.
- **6.10 Bigger arena** — grow the play space so the yeti can genuinely lose you.
  Still fixed and finite (not streaming / infinite — that's parked). Rescale the
  6.3 ring and any distances tuned to the old size.
- **6.11 Yeti search & investigate state** — on losing sight, the yeti searches
  the player's last-known position before resetting to wander; "shake him off" =
  break LOS + change direction + stay unseen ~4–6 s. Adds a reusable "investigate
  a point" behaviour for 6.12 and 6.14. Still not pathfinding.
- **6.12 Sheds** *(needs 6.11)* — enterable sheds: hidden from detection, slower
  warmth drain. Yeti periodically checks the nearest one with a tell (footfalls /
  breathing / door rattle) and a cooldown. Hiding trades safety for warmth + lost
  ember time.
- **6.13 Snacks + blanket** — rare consumables. Snack: press E to eat, locks
  stamina at full for a window. Blanket: press Q to wrap up, slower warmth drain
  for a window.
- **6.14 Decoy** *(needs 6.11, pairs with 6.7)* — throwable; yeti diverts to
  investigate for a few seconds, resetting a chase. Rare; spawns near the green
  ember.

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
