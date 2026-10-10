// Done ticks for mazes, and the mazes in play: which mazes a signed-in player has finished, and
// which they've started and not. Finished is never saved — it is worked out as the maze page works
// it out, every line of the checklist ticked, from the cells of what they've found
// (core/maze/play-core.js); where they stand doesn't come into it. Started is having moved off the
// start or found anything. Only the files of mazes the player has a place or a find in are opened —
// which those are, the reading a page at a time, and the rail's order, are
// core/wordsearch/done-core.js's, as for a wordsearch. Pure — the reading is ui/wordsearch/done-ui.js.
import { mazeBoard, mazeFinished, resumedMaze } from './play-core.js';
import { lastPlayed } from '../wordsearch/done-core.js';

// The started mazes that are finished: opened is each one's file as it was opened, in the same
// order — a file that couldn't be opened is never finished.
export function doneMazes(rows, started, opened) {
  return started.filter(function (id, i) {
    return opened[i].status === 'fulfilled' && mazeDone(rows, id, opened[i].value);
  });
}

// The opened mazes still being played: started and not finished. places are the player's saved
// places, rows their finds. A file that couldn't be opened is never in play.
export function playingMazes(places, rows, started, opened, done) {
  return started.filter(function (id, i) {
    return opened[i].status === 'fulfilled' && !done.includes(id) && mazeStarted(places, rows, id, opened[i].value);
  });
}

function mazeStarted(places, rows, hiddenId, maze) {
  var start = String(mazeBoard(maze).start);
  var moved = places.some(function (row) { return row.puzzle === hiddenId && String([row.cell_row, row.cell_col]) !== start; });
  return moved || rows.some(function (row) { return row.puzzle === hiddenId; });
}

// When each maze was last played: the later of when the player last moved there and their latest find.
export function mazeLastPlayed(places, rows) {
  var last = lastPlayed(rows, 'found_at');
  lastPlayed(places, 'moved_at').forEach(function (at, id) { last.set(id, [last.get(id) || '', at].sort()[1]); });
  return last;
}

function mazeDone(rows, hiddenId, maze) {
  var board = mazeBoard(maze);
  var found = rows.filter(function (row) { return row.puzzle === hiddenId; }).map(function (row) { return [row.cell_row, row.cell_col]; });
  return mazeFinished(resumedMaze(board, board.start, found), board);
}
