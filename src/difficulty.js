// Easy / Medium / Hard. Added after playtests where phone players kept stalling
// at level 2 — the game only ever had one setting, and it was punishing.
//
// HARD is that original setting: every number in levels.js (the 6.6 curve) and
// the warmth drain in Survival.jsx is a HARD number, tuned over a lot of
// playtesting, and the 'hard' mods below are all 1 — identity — so that path is
// byte-for-byte unchanged. MEDIUM (the new default) and EASY scale the same
// four levers that decide whether an early level is survivable:
//
//   warmthDrain   — how fast warmth bleeds while you're out in the cold
//   yetiSpeed     — the yeti's sustained chase AND close-range lunge speed
//   detectRadius  — how far away it notices you (lose / reacquire rings follow)
//   commitDelay   — how long you can sit in its sightline before it gives chase
//
// Everything else about the curve — ember targets, the wander leash, shed
// checks, the search window — is the same in all three modes.

export const DIFFICULTIES = ['easy', 'medium', 'hard']
export const DEFAULT_DIFFICULTY = 'medium'

const MODS = {
  easy: { warmthDrain: 0.55, yetiSpeed: 0.8, detectRadius: 0.62, commitDelay: 2.2 },
  medium: { warmthDrain: 0.78, yetiSpeed: 0.9, detectRadius: 0.82, commitDelay: 1.5 },
  hard: { warmthDrain: 1, yetiSpeed: 1, detectRadius: 1, commitDelay: 1 },
}

// An unknown or missing difficulty falls back to the identity (hard) mods, so a
// bare levelParams(L) — which is every call in the test suite — still reads the
// raw curve.
export function difficultyMods(difficulty) {
  return MODS[difficulty] || MODS.hard
}

// Session preference, remembered across runs and reloads. Kept out of the store
// so a fresh load starts on the last mode the player chose.
const STORAGE_KEY = 'yeti:difficulty'

export function loadDifficulty() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return DIFFICULTIES.includes(stored) ? stored : DEFAULT_DIFFICULTY
  } catch {
    return DEFAULT_DIFFICULTY
  }
}

export function saveDifficulty(difficulty) {
  try {
    if (DIFFICULTIES.includes(difficulty))
      localStorage.setItem(STORAGE_KEY, difficulty)
  } catch {
    // private mode / storage disabled — the choice just won't survive a reload
  }
}
