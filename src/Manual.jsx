import { useEffect } from 'react'

// First-time player's manual. Reached from the "How to play" button on the
// start screen and the pause card (Hud.jsx). Plain scrollable overlay — it's
// only ever opened while the game is idle or paused, so there's nothing running
// behind it to freeze. Esc or the close button dismisses it.
//
// The copy is deliberately plain: this game gets played with a kid, so it reads
// like someone explaining it out loud, not a spec sheet.
export default function Manual({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.code === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="manual"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
    >
      {/* Stop clicks inside the card from closing the overlay or reaching the
          canvas underneath (which would grab pointer lock). */}
      <div className="manual-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="manual-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h1>Yeti Survival</h1>

        <section>
          <h2>What is this?</h2>
          <p>
            You're alone in a snowy forest at dusk, and there's a yeti out there
            hunting you. You can't fight it. All you can do is keep moving, stay
            warm, and grab the glowing embers scattered around before the cold —
            or the yeti — gets you.
          </p>
        </section>

        <section>
          <h2>The point of the game</h2>
          <p>
            Survive and score. Each run is a climb through <strong>6 levels</strong>.
            To clear a level you have to collect all of that level's embers, then
            you get a short calm breather before the next wave starts and the
            yeti wakes back up.
          </p>
          <p>
            Clear all 6 and you win — dawn breaks and the yeti gives up. Get
            caught or freeze first and the run ends on a game-over screen with
            your score: level reached, time survived, and a bonus for every ember
            you grabbed.
          </p>
          <p>
            The <strong>first</strong> time you die in a run you get one second
            chance — press <kbd>C</kbd> (or tap <strong>Keep going</strong>) to
            respawn back at the start with your warmth refilled and the yeti
            thrown off, keeping your score and level. Use it or lose it: die
            again, or pick <strong>Start over</strong>, and it's back to Level 1.
          </p>
        </section>

        <section>
          <h2>Difficulty</h2>
          <p>
            Pick <strong>Easy</strong>, <strong>Medium</strong> or{' '}
            <strong>Hard</strong> on the start screen (or any game-over screen).
            Higher settings drain your warmth faster and make the yeti quicker,
            sharper-eyed and faster to give chase. <strong>Hard</strong> is the
            original tuning; <strong>Medium</strong> is a good place to start. The
            climb, the embers and everything else are the same in all three.
          </p>
        </section>

        <section>
          <h2>Controls — keyboard &amp; mouse</h2>
          <ul className="manual-keys">
            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</li>
            <li><kbd>Mouse</kbd> Look around</li>
            <li>
              <kbd>double-tap&nbsp;W</kbd> (hold) Sprint — <kbd>Shift</kbd> also
              works. Sprinting is fast but burns stamina.
            </li>
            <li>
              <kbd>Left-click</kbd> Glance behind you — a quick look back to check
              if the yeti's still on your tail. The view frosts over after a
              second, then you're facing forward again. Short cooldown.
            </li>
            <li><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> Use the item in that carry slot. Your items always sit packed from the left, so <kbd>1</kbd> is whatever you picked up first.</li>
            <li><kbd>Q</kbd> Use your first item — same as <kbd>1</kbd></li>
            <li><kbd>R</kbd> Drop your first item on the ground (while playing)</li>
            <li><kbd>Space</kbd> Pause / resume</li>
            <li><kbd>R</kbd> Restart — on the game-over screen (nothing to drop there)</li>
            <li><kbd>Esc</kbd> Release the mouse</li>
          </ul>
        </section>

        <section>
          <h2>Controls — phone / touch</h2>
          <ul className="manual-keys">
            <li><strong>Left thumb</strong> Drag anywhere on the left to move. Push past the ring to lock a sprint.</li>
            <li><strong>Right thumb</strong> Drag to look around.</li>
            <li><strong>Buttons, bottom-right</strong> Glance back, and one button per item you're carrying — tap to use, long-press to drop.</li>
            <li>Hold the phone in landscape. Tap once at the start to go fullscreen.</li>
          </ul>
        </section>

        <section>
          <h2>Your two meters</h2>
          <p>
            <strong>Warmth</strong> (top-left) drains the whole time you're
            outside. Hit zero and you freeze. Embers top it up a little, but the
            real fix is the blanket. It stops draining during the between-level
            breather.
          </p>
          <p>
            <strong>Stamina</strong> (under warmth) drains while you sprint and
            refills while you walk. Run it dry and you're stuck at walking speed
            until it recovers — so don't sprint the whole time, save it for when
            the yeti is actually close.
          </p>
        </section>

        <section>
          <h2>The yeti</h2>
          <p>
            It wanders the arena until it spots you. The HUD tells you what it's
            doing:
          </p>
          <ul>
            <li><strong>"he sees you"</strong> — full chase. It's faster than your walk but a little slower than your sprint (early on), so a straight sprint opens a gap. Later levels it's almost as fast as your sprint.</li>
            <li><strong>"he's searching"</strong> — you broke its line of sight. It goes to where it last saw you and hunts around. Change direction, stay out of sight for about 5 seconds and it gives up.</li>
            <li><strong>"he's distracted"</strong> — a decoy pulled it away.</li>
          </ul>
          <p>
            Past level 5 you can't out-run it any more — you have to break line
            of sight (trees, sheds, corners) and lose it.
          </p>
        </section>

        <section>
          <h2>Embers</h2>
          <p>
            <strong>Orange embers</strong> are the main goal — walk over one to
            collect it. Worth points and a small warmth top-up. Clear the level's
            count to move on.
          </p>
          <p>
            <strong>Green ember</strong> — one at a time, and it spawns right near
            the yeti. Worth a lot more points. Sprinting near it gives you a
            speed boost, and you get a bonus for getting clear afterward. High
            risk, high reward.
          </p>
        </section>

        <section>
          <h2>Items you can carry</h2>
          <p>
            You have 4 slots. Walk over an item to pick it up. Press{' '}
            <kbd>1</kbd>–<kbd>4</kbd> to use whatever's in that slot (on a phone,
            tap its button).
          </p>
          <ul>
            <li><strong>Snack</strong> — locks your stamina at full for about 8 seconds. Eat it right before a big sprint.</li>
            <li><strong>Water bottle</strong> — a <strong>Nightfall</strong> reward: only shows up once you've beaten the game and it's properly dark out, in place of the snack. Locked stamina like a snack, but a longer window and a much bigger speed boost — a real "get clear" button.</li>
            <li><strong>Blanket</strong> — sets down on the ground. Stand on it and your warmth drains much slower. You can walk back to it later.</li>
            <li><strong>Decoy</strong> — throw it and the yeti breaks off to investigate it for a few seconds, resetting a chase.</li>
          </ul>
          <p>
            <kbd>R</kbd> drops your first item on the ground; on a phone,
            long-press its button. A faint arrow around the crosshair points the
            rough direction back to your nearest dropped item — walk back over it
            with a free slot to pick it up again.
          </p>
        </section>

        <section>
          <h2>Sheds</h2>
          <p>
            You can step inside a shed. The yeti can't detect you in there and
            your warmth drains slower — but not zero, so you can't camp forever.
            Every so often the yeti walks over to check the nearest shed (you'll
            hear it at the door). Hiding costs you warmth and ember-collecting
            time, so it's a trade.
          </p>
        </section>

        <section>
          <h2>What the levels bring</h2>
          <ul>
            <li><strong>Levels 1–4</strong> — the yeti gets a bit faster and spots you from a bit further each level, but you can still out-sprint it.</li>
            <li><strong>Levels 5–6</strong> — its speed caps just below your sprint. Now it's about detection range, how fast it commits to a chase, and how long it searches. You survive by hiding, not running.</li>
            <li><strong>Between levels</strong> — about 8 seconds of calm. Warmth stops draining, the yeti backs off, and the next level number flashes up.</li>
            <li><strong>Clear all 6</strong> — you win, and it unlocks <strong>Nightfall</strong>: the same 6 levels again but every one starts 4 rungs harder. Level 1 of Nightfall already bites like a normal Level 5.</li>
          </ul>
        </section>

        <section>
          <h2>Tips for your first run</h2>
          <ul>
            <li>Keep moving. Standing still just drains warmth for nothing.</li>
            <li>Walk to recover stamina; only sprint when the yeti's close.</li>
            <li>Glance behind you often so a chase doesn't surprise you.</li>
            <li>Grab embers on the way past — don't cross the whole map for one.</li>
            <li>Save the decoy for when you're genuinely cornered.</li>
          </ul>
        </section>

        <button type="button" className="manual-done" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
