# Yeti Survival — v2 / Post-Step-6 Backlog

**Status:** folded into the README as **Step 7** (chase-fair, inventory, controls, world)
and **Step 8** (AI escalation & replay) on 2026-09-07. This doc is kept as the reasoning
trail — why each call was made, what was refined, what was rejected. The README sections
are the live scope; edit those, not this.

---

## Prerequisite: fix the linear chase

**Problem:** the yeti re-aims at the player's exact position every frame, so cutting/juking
does nothing — it's always instantly behind you. Feels unfair rather than scary.

**Fix (two parts; #1 is required before the mirror is worth building):**
1. **Max turn rate** on the yeti's heading — a hard 90° cut opens a gap it has to arc back
   from. This alone makes the chase feel like a chase.
2. **Coarse feedback** so you can see the cut working — the **mirror** (below) is that
   feedback. Bearing deliberately stays *out* of the hint system.

This underpins the whole hide-and-seek group. Without it, hiding / juking / decoys all feel
unfair. Treat as a prerequisite sub-step.

---

## Decisions locked

### Sheds (extends 6.12)
- Enter **unseen** → safe: hidden from detection, slower warmth drain.
- Enter **while chased** → yeti waits outside a few seconds, then loses interest. It cannot
  open the door.
- Shed floor is hard ground — leaves no footprints.

### Two yetis — Hunter + Guardian (from L5)
Replaces the earlier "wanderer" idea. The Guardian has a *job*, which is why it's better.
- **Hunter:** constantly hunts. Ramps on the existing 6.6 dial — detection radius, chase
  commit, last-known search time, shed-check cadence, wander tightness.
- **Guardian:** patrols the **green ember** (6.7). Ramps on its **own separate track** —
  tighter patrol radius, wider aggro, and at high levels peels off to chase briefly before
  returning to post.
- Net effect at L5+: **one chaser + one guarded high-value zone**, not two chasers.
  Reframes 6.7 as "raid the Guardian's turf while the Hunter is still on you."

### Nightfall / endless mode
- Unlocked by clearing 10 levels (per 6.6).
- Shorter calm interludes, both yetis always present, ramps forever. Score = how far you get.

### Footprints
- Player leaves tracks in snow; an **investigating** yeti (6.11 state) follows them toward
  last-known.
- Tracks fade over time. Hard ground (rock, ice, shed floor) leaves none.

### Distracted feeding
- Yeti occasionally stops to feed, fully blind for a few seconds.
- Spawns near a level's **final** ember cluster — the last pickups of each level are the
  tensest.

### Roar / stun
- Telegraphed roar. If the player is in the yeti's sightline when it lands: brief slow +
  screen shake.
- Punishes standing still in the open.

### Daily seed
- One fixed seed per calendar day for score comparison (you vs son). No persistent
  leaderboard.

### Blanket (extends 6.13)
- Placeable. Slows warmth drain while the player stands on it.
- **Vague HUD hint** — fuzzy direction pip, no exact distance — points back toward where it
  was dropped.
- Same hint applies to any item dropped to free an inventory slot.

### Inventory
- Exactly **4 carried slots**. Keys: **V, B, N, M**.
- ~6 possible consumables compete for 4 slots: hand warmer, water bottle, snack, blanket,
  throwable, flare.
- Slots are **generic** — pick items up into whatever slot is free, not one key per item
  type.
- Full inventory → **drop** one item (stays in world, findable via the vague hint) to pick
  up another.
- The mild awkwardness of reaching for V/B/N/M while moving + steering is **intentional** —
  "fumbling in your pocket one-handed." Do not smooth it out. Possibly lean in: using an
  item briefly locks you to walk speed.

### Mirror / look behind
- Key: **L** (LOOK). Camera glances behind the player.
- **Time-limited:** the view frosts / fogs over after ~1–2 s — a quick check, not a
  rear-view mirror. Possible short cooldown.
- Deliberately **separate from the hint system** — the hint system does not get yeti
  bearing. You cut, then check the mirror.

### Jump
- **Space = jump**, with its own small bar (can't spam).
- Low obstacles (logs) — player hops them; yeti has no jump + wider collision, so it detours
  around. Pairs with 6.9 tree colliders. Yeti stays dumb.

### Sprint
- **No rework yet.** Move off the pinky: sprint → **mouse thumb button (Mouse4)**, Shift
  kept as an alias. Still hold-to-sprint.
- Toggle / fixed-burst model (tap = spend a ~20% chunk) is **parked** — revisit after
  playtesting the rebind.

### Pause
- **Esc** = pause menu + mouse released, in **one** action (the browser exits pointer-lock
  on the first Esc, so a two-press design isn't reliable).
- Click **Resume** to re-lock the pointer.

---

## Refined — direction agreed, details open

### Water bottle
- **Night-only** consumable: locks stamina at full + small speed boost for a window.
- Overlaps the 6.13 snack's locked-stamina effect → **merge**: snack = day version (locked
  stamina), water bottle = night version (locked stamina + speed).

### Throwables (extends 6.14 decoy)
- **Squeaky duck:** loud squeak on landing. Short, snappy lure to the point.
- **Poop:** fart / squish on landing. Yeti walks over, sniffs, recoils **disgusted**, then
  leaves — longer distraction window than the duck, no repeat interest.
- Both reuse 6.11's "investigate a point." Ship both — the humor is a feature for playing
  with a kid.

### Frozen pond
- Fast to cross. **Cracks if you sprint** across → fall = big warmth hit + ~1 s immobilize.
- Yeti avoids the ice → forced to detour. A shortcut with a risk.

### Campfire
- Stand in radius → warmth regen. **While lit, detection range against you balloons.**
- Direct risk/reward on the core stat.

### Weather events
- **Wind gust:** directional, accelerates warmth drain when moving into it, readable in the
  snow particles.
- **Sleet:** cuts vision.
- Event-based, not a full weather system (CLAUDE.md keeps heavy weather out).

### Flare
- Throwable. Lights an area **and** makes the yeti avoid that zone for a while — area
  denial, the inverse of the duck.
- Doubles as vision through fog / night. Rare.

### Per-level modifiers
- Occasional twist levels: blizzard (vision cut), blackout (no HUD), double embers.
- Cheap variety on top of the linear ramp.

---

## Parked — not sold yet

- **Deep snow drifts + snowshoes** — a pair; snowshoes only matter if drifts exist. Revisit
  together.
- **Scent-vs-sight detection modes** — found confusing; night mode already carries the
  "scarier detection" job.
- **Sprint toggle / burst rework** — revisit after the Mouse4 rebind playtest.
- **Mirror as a physical held item** (vs the base L-key glance) — later, maybe.

---

## Control map (working)

| Action | Input | Notes |
|---|---|---|
| Move | WASD | |
| Look | Mouse | pointer-locked |
| Sprint | Mouse4 (thumb) + Shift alias | hold; no behavior change |
| Jump | Space | own small bar |
| Look behind | L | camera glance, fogs after ~1–2 s |
| Pause | Esc | pause + mouse release in one press; click Resume to re-lock |
| Item slots | V, B, N, M | 4 generic slots; drop to swap |

**Open:** V/B/N/M ergonomics with the right hand on the mouse — playtest whether the
"fumble" feels tense-good or just bad. Left-side keys are the fallback.

---

## Conflicts already resolved here

- README **6.13 "press S to eat"** → S is walk-backward. Replaced by the V/B/N/M inventory.
  **Patch the README when Step 6 reaches 6.13.**
- Mirror was "M" in early chat → M is now an inventory slot. Mirror moved to **L**.

---

## Sequence from here

1. **Redline this doc.**
2. Finish the in-flight Step 6 work (currently uncommitted — looks like the levels system,
   ~6.6).
3. Continue Steps 6.7–6.14 as written in the README.
4. Fold the survivors here into the README as a **Step 7** section; apply the 6.13 key patch
   at that point.
5. Build Step 7 — one sub-step, one commit, one playtest each, same discipline as Step 6.
