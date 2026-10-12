// Done ticks for minesweeper boards, and the boards in play: which boards a signed-in player has
// finished, and which they've started and not. A board's row says whether it's finished — the
// minesweeper page saves it with the marks (core/minesweeper/progress-core.js) — so no board's file
// is ever opened for it. Started is any square marked. Which boards the tiles stand for, the reading
// a page at a time, and the rail's order, are core/wordsearch/done-core.js's, as for a wordsearch.
// Pure — the reading is ui/wordsearch/done-ui.js.
import { startedPuzzles } from '../wordsearch/done-core.js';

function rowOf(rows, hiddenId) {
  return rows.filter(function (row) { return row.puzzle === hiddenId; })[0];
}

// The boards the tiles stand for that the player has finished.
export function doneBoards(rows, tiles) {
  return startedPuzzles(rows, tiles).filter(function (id) { return rowOf(rows, id).finished === true; });
}

// The boards the tiles stand for still being played: a square marked, and not finished.
export function playingBoards(rows, tiles, done) {
  return startedPuzzles(rows, tiles).filter(function (id) {
    var row = rowOf(rows, id);
    return !done.includes(id) && row.mines.length + row.no_mines.length > 0;
  });
}
