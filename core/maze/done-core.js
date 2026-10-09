// Done ticks for mazes: which mazes a signed-in player has finished. Finished is never saved — it
// is worked out as the maze page works it out, every line of the checklist ticked, from the cells
// of what they've found (core/maze/play-core.js, core/maze/progress-core.js); where they stand
// doesn't come into it. Only the files of mazes the player has found something in are opened —
// which those are, and the reading a page at a time, are core/wordsearch/done-core.js's, as for a
// wordsearch. Pure — the reading is ui/wordsearch/done-ui.js.
import { mazeBoard, mazeFinished } from './play-core.js';
import { restoredMaze } from './progress-core.js';

// The started mazes that are finished: opened is each one's file as it was opened, in the same
// order — a file that couldn't be opened is never finished.
export function doneMazes(rows, started, opened) {
  return started.filter(function (id, i) {
    return opened[i].status === 'fulfilled' && mazeDone(rows, id, opened[i].value);
  });
}

function mazeDone(rows, hiddenId, maze) {
  var board = mazeBoard(maze);
  var mine = rows.filter(function (row) { return row.puzzle === hiddenId; });
  return mazeFinished(restoredMaze(board, [], mine), board);
}
