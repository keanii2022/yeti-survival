# Step 9 — Mobile / touch: build spec

Companion to the README "Step 9" section. This file pins the acceptance checks
and the feel numbers an autonomous session can't playtest. Numbers are starting
points — expose each as a named constant so they're tunable from a real phone.

## Ground rules (do not violate)

- Branch `step-9-mobile` off `main`. Never commit to `main`, never force-push.
- Git identity: `Keani Antezana` / `99574780+keanii2022@users.noreply.github.com`.
  Verify `git config user.email` before the first commit.
- Desktop keyboard/mouse path stays behaviourally unchanged. The touch layer is
  **additive**, mounted only when coarse-pointer is detected.
- All existing tests stay green. Add tests for new pure logic (joystick vector,
  sprint-latch hysteresis, pointer-type detection) in the existing `*.test.js`
  style.
- `npm run build` stays green.
- One commit per sub-step, README commit-message style, no attribution trailer.
- If a sub-step is blocked or genuinely ambiguous: commit what's done, note it in
  the PR, move to the next. Don't stall the whole run.

## 9.1 Touch detection + drag-look

- Detect with `matchMedia('(pointer: coarse)')`; also treat a first `touchstart`
  as coarse. Store as `isTouch` in the game store.
- Look zone = right 55% of the viewport. A touch that starts on a button or in
  the joystick zone never drives look.
- Drag-look sensitivity: **0.004 rad per CSS px** (mouse path via
  PointerLockControls is ~0.002 rad/px; drag strokes are shorter). No inertia.
- Pitch clamp identical to desktop. No pointer-lock calls on touch.
- Accept: on an emulated 812×375 touch viewport, dragging the right side turns
  the view smoothly, dragging the left side does not.

## 9.2 Movement joystick

- Floating: appears where the thumb lands within the left 45% of the viewport.
- Base radius **60 px**; deadzone **12%**; full move speed at 100% radius.
- Sprint latch: drag past **1.4× base radius** (~85 px) latches sprint; pull back
  inside base radius to release. `navigator.vibrate?.(10)` on latch if present.
- Replaces WASD + Shift on touch only.
- Accept: move vector scales with offset, sprint latches past the ring and
  releases when pulled back; unit test on the vector + hysteresis math.

## 9.3 On-screen action buttons

- **56 px** diameter targets, **12 px** gaps, bottom-right arc, clear of the
  joystick zone.
- L (glance) always shown. E / Q shown only while holding that consumable. F
  shown only while holding a decoy. Reuse the existing key-action handlers — a
  tap fires the same code path as the key.
- Buttons swallow the touch so it never leaks into look.
- Accept: tapping each fires the same effect as its key; hidden when not
  applicable.

## 9.4 Responsive HUD + full-bleed threat vignette

- Compact HUD when `isTouch` or viewport height < 480: bars scale ~0.8, tighten
  to the top-left.
- Threat "he sees you" red becomes a full-viewport vignette (`inset: 0`), not the
  fixed inset box.
- Accept: at 812×375 nothing clips or overlaps the joystick/buttons; vignette
  covers the whole screen.

## 9.5 Mobile performance tier

- When `isTouch`: clamp DPR to **1.5**; instanced trees to **60%** of desktop
  count; snow density to **50%**; one shadow-casting light with a 512 map, or
  shadows off if still heavy.
- Accept: builds and runs; note in the PR that framerate needs real-device
  confirmation.

## 9.6 Landscape + fullscreen

- Portrait: full-screen "rotate to landscape" overlay; pause input while shown.
- First tap anywhere: best-effort `requestFullscreen()` (fine if iOS Safari
  ignores it).
- Add `manifest.webmanifest` (`display: standalone`, `orientation: landscape`) +
  `apple-touch-icon`, linked from `index.html`.
- Accept: portrait shows the nudge, landscape hides it; manifest validates.

## Verification bar (no real device available)

Vite preview + browser mobile emulation, touch emulation on. Capture and attach
to the PR:

1. Portrait rotate nudge (375×812).
2. Landscape gameplay (812×375) showing joystick + buttons + HUD.
3. A threat-vignette frame.

## Done

When 9.1–9.6 are committed (or a blocker is hit), open a PR against `main`
titled "Step 9 — Mobile / touch" whose body is this checklist, each item marked
with what was verified in emulation and what still needs a real-phone playtest.
**Do not merge.**
