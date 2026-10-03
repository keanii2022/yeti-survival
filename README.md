# Yeti Survival

[![tests and deploy](https://github.com/keanii2022/yeti-survival/actions/workflows/deploy.yml/badge.svg)](https://github.com/keanii2022/yeti-survival/actions/workflows/deploy.yml)

**▶ Play it: [keanii2022.github.io/yeti-survival](https://keanii2022.github.io/yeti-survival/)**

## What it does

A 3D survival game in the browser that I'm building for fun with my
son. You collect embers to stay warm in a snowy arena while a yeti hunts
you. You can't outrun it forever, so you have to break its line of sight
and hide.

## How it works

I build it with Claude Code, one small step at a time. `CLAUDE.md` holds
the build plan. That's nine numbered steps, each split into sub-steps,
plus what's deliberately out of scope. Each Claude Code session takes on
one sub-step, makes one commit, and stops.

**Where a human approves:**

- **Playtesting.** My son and I play the game after each sub-step
  before the next one starts. Speed, difficulty, and run length were
  all tuned from what we found. For example, the run length went from
  10 levels to 6, 8, then back to 6.
- **Scope.** `CLAUDE.md` says Claude must ask before any commit that
  touches more than one build step. It also says never to force-push
  the public history without asking.
- One exception, written down plainly: I had Step 8 built in one batch
  to save time, so it still needs a full playtest before I call it done.

The game itself: a yeti whose turning speed is capped, so cutting and
juking actually opens a gap. It searches where it last saw you and
checks the sheds you hide in. The game also has warmth and stamina,
levels that get harder, an inventory of items, Easy/Medium/Hard modes,
full phone/touch controls, and music that reacts to the chase.

## How I know it works

321 automated tests across 28 files (Vitest). They run on every push,
and a failing test stops the game from deploying (badge above). They
cover the game rules, the yeti's decision-making helpers, levels, and
controls. The 3D scene
itself is checked by playtesting. A few real test names from the output:

```
✓ store.test.js > tickWarmth > ends the run in "frozen" when warmth runs out
✓ store.test.js > run status transitions > catchPlayer ends the run, and only from "playing"
✓ store.test.js > revivePlayer — one-time second chance > only fires once per run
✓ levels.test.js > levelParams — the curve > never lets the sustained chase reach sprint speed
✓ levels.test.js > levelParams — difficulty > never lets even the hard-mode deep chase reach sprint speed
✓ feeding.test.js > rollFeed > resolves to feed when the roll beats the odds
✓ dailySeed.test.js > reseedDaily / dailyRandom > produces the same sequence of draws for the same date
Test Files  28 passed (28)
     Tests  321 passed (321)
```

## A bug I found, and what it changed

In playtesting, the yeti never once stopped to feed. Feeding is a
designed break where it wanders off to eat, giving you a window to
escape. The feeding tests all passed. The bug was in the order of the
yeti's checks inside the game scene. It only rolled for feeding when it
couldn't sense you. But at deep levels it stays close to you, so it
almost always could. I moved the feeding roll ahead of the detection
check, so it can fire whenever the yeti is idle. What it changed:
unit tests prove the pieces work, and playtesting is how we catch
problems in how the pieces fit together. That's why the playtest
checkpoint stays in the process.

## How to run it

```bash
npm install
npm test       # the 321 tests
npm run dev    # then open the printed local URL
```

**WASD** move, **Shift** sprint, **Space** jump, **1–4** use an item,
**R** drop, **left-click** glance behind, **V** switch camera, **Esc**
pause. Touch controls switch on automatically on a phone or tablet.

Built with React, React Three Fiber (3D), Rapier (physics), zustand
(game state), and howler.js (audio). The full build log is in
[NOTES.md](NOTES.md).
