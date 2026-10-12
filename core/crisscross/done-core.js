// Done ticks for criss-crosses, and the criss-crosses in play: which shapes a signed-in player has
// finished, and which they've started and not. A shape's row says whether it's finished — the
// criss-cross page saves it with the words (core/crisscross/progress-core.js) — so no shape's file
// is ever opened for it. Started is any word placed beyond the starting one, which is never saved.
// Which shapes the tiles stand for, the reading a page at a time, and the rail's order, are
// core/wordsearch/done-core.js's, as for a minesweeper board. Pure — the reading is
// ui/wordsearch/done-ui.js.
import { startedPuzzles } from '../wordsearch/done-core.js';

function rowOf(rows, hiddenId) {
  return rows.filter(function (row) { return row.puzzle === hiddenId; })[0];
}

// The shapes the tiles stand for that the player has finished.
export function doneShapes(rows, tiles) {
  return startedPuzzles(rows, tiles).filter(function (id) { return rowOf(rows, id).finished === true; });
}

// The shapes the tiles stand for still being played: a word placed, and not finished.
export function playingShapes(rows, tiles, done) {
  return startedPuzzles(rows, tiles).filter(function (id) {
    return !done.includes(id) && rowOf(rows, id).words.length > 0;
  });
}
