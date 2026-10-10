// Done ticks: which puzzles a signed-in player has finished, and which tiles wear a ✓. Finished is
// never saved — it is worked out as the play page works it out, every placed word's line saved
// (core/wordsearch/play-core.js, core/wordsearch/progress-core.js). Only the files of puzzles the
// player has saved a find in are ever opened, never every puzzle on the page. The same read says
// which started puzzles are still in play, for the landing page's Continue playing rail, and in
// what order, mazes among them. Pure — the reading is ui/wordsearch/done-ui.js.
import { playBoard, restoredPlay, finished } from './play-core.js';
import { restoredFinds } from './progress-core.js';

// The player's saved lines are read a page of rows at a time — Supabase answers at most 1000 rows
// to one read. The rows the nth read asks for, from 0: first and last, both counted.
export function readRange(n) {
  var size = 1000;
  return [n * size, (n + 1) * size - 1];
}

// A read that filled its range may have more after it; a short one is the last.
export function morePages(rows, range) {
  return rows.length === range[1] - range[0] + 1;
}

// The puzzles the page's tiles stand for that the player has saved a find in, by hidden ID, each
// once — the only puzzle files opened. A saved line for a puzzle no tile stands for opens nothing.
export function startedPuzzles(rows, tiles) {
  var saved = new Set(rows.map(function (row) { return row.puzzle; }));
  var ids = new Set(tiles.flatMap(function (tile) { return tile.ids; }));
  return [...ids].filter(function (id) { return saved.has(id); });
}

export function puzzleFile(hiddenId) {
  return '../content/puzzles/wordsearch/' + hiddenId + '.json';
}

// The started puzzles that are finished: opened is each one's file as it was opened, in the same
// order — a file that couldn't be opened is never finished.
export function donePuzzles(rows, started, opened) {
  return started.filter(function (id, i) {
    return opened[i].status === 'fulfilled' && puzzleDone(rows, id, opened[i].value);
  });
}

// The started puzzles still being played — the Continue playing rail's — the one found in most
// recently first: its file opened, and not finished. A file that couldn't be opened is never in
// play: no rail beats a wrong one.
export function playingPuzzles(rows, started, opened, done) {
  return railOrder(started.filter(function (id, i) { return opened[i].status === 'fulfilled' && !done.includes(id); }),
    [lastPlayed(rows, 'found_at')]);
}

// When each puzzle was last played: the latest time among its saved rows, column naming the time a
// row holds — a wordsearch's lines their found_at, a maze's place its moved_at and its finds their
// found_at (core/maze/done-core.js).
export function lastPlayed(rows, column) {
  var last = new Map(rows.map(function (row) { return [row.puzzle, '']; }));
  rows.forEach(function (row) { last.set(row.puzzle, [last.get(row.puzzle), row[column]].sort()[1]); });
  return last;
}

// The Continue playing rail, puzzles of every kind together: the one played most recently first,
// by lasts, each kind's last played times.
export function railOrder(playing, lasts) {
  var last = new Map(lasts.flatMap(function (times) { return [...times]; }));
  return playing.slice().sort(function (a, b) { return last.get(b).localeCompare(last.get(a)); });
}

function puzzleDone(rows, hiddenId, puzzle) {
  var words = playBoard(puzzle).words;
  var mine = rows.filter(function (row) { return row.puzzle === hiddenId; });
  return finished(restoredPlay(restoredFinds(mine, words)), words);
}

// A tile is ticked once every puzzle it stands for is finished: a puzzle's tile its own, a
// collection's every one in it. A collection with no puzzles is never ticked.
export function tileDone(tile, done) {
  return tile.ids.length > 0 && tile.ids.every(function (id) { return done.includes(id); });
}
