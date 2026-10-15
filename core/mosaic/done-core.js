// Done ticks for mosaics, the mosaics in play, and a finished mosaic's name on its tile. A mosaic's
// row says whether it's finished — the mosaic page saves it with the squares
// (core/mosaic/progress-core.js) — and only rows with a square marked are ever read, so a board's
// squares are never fetched for the ticks: every row read is started. A finished mosaic's tile reads
// its picture's name in place of its title, for the player who finished it alone (the owner,
// 2026-10-13) — the name is only in the mosaic's file, so the files of the finished ones, and no
// others, are opened for it. Which mosaics the tiles stand for, the reading a page at a time, and the
// rail's order, are core/wordsearch/done-core.js's, as for a minesweeper board. Pure — the reading
// is ui/wordsearch/done-ui.js.
import { startedPuzzles } from '../wordsearch/done-core.js';

function rowOf(rows, hiddenId) {
  return rows.filter(function (row) { return row.puzzle === hiddenId; })[0];
}

// The mosaics the tiles stand for that the player has finished.
export function doneMosaics(rows, tiles) {
  return startedPuzzles(rows, tiles).filter(function (id) { return rowOf(rows, id).finished === true; });
}

// The mosaics the tiles stand for still being played: every one read is started, so those not
// finished.
export function playingMosaics(rows, tiles, done) {
  return startedPuzzles(rows, tiles).filter(function (id) { return !done.includes(id); });
}

// The finished mosaics' names, by hidden ID: opened is each one's file as it was opened, in the same
// order — a file that couldn't be opened names nothing, and its tile keeps its title.
export function mosaicNames(done, opened) {
  return Object.fromEntries(done.map(function (id, i) { return [id, opened[i]]; })
    .filter(function (pair) { return pair[1].status === 'fulfilled'; })
    .map(function (pair) { return [pair[0], pair[1].value.name]; }));
}
