// The one number every distance in the game is tuned against: half-width of the
// walkable arena, a square centred on the origin. Step 6.10 grew it from 30 (the
// old 60x60 pen was barely wider than the yeti's lose-radius, so a chase always
// ended at a wall); at 120x120 there's room to cut into the fog and shake him.
//
// It lived in Player.jsx through 6.11, which still re-exports it so nothing that
// imported it from there had to move. It's here on its own now so the pure,
// R3F-free modules (sheds.js and its tests) can read it without pulling the
// whole first-person controller — and its dependency on three / drei — in with it.
export const ARENA_HALF = 60
