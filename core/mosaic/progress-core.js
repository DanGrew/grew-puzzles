// Saved mosaic progress: what a pause in tapping saves, and how a saved board comes back. A mosaic
// is one row, saved over — the whole board as one character a square, never one row per square —
// and whether it is finished. The table, and that a player reaches only their own row, are
// grew-puzzles-tooling's docs/DATABASE.md. A big board isn't sent on every tap: the page waits for a
// pause in tapping and sends the board as it stands then (the product's TASK-167 spec), through the
// one-slot wait a maze's place uses (core/maze/progress-core.js), so the last board always wins.
// Joining a saved board on signing in, and Undo's history then, are a minesweeper board's
// (core/minesweeper/progress-core.js joinedMines, joinedHistory), judged against the board as it
// opens — its 0s and 9s filled in (the product's TASK-209) — rather than against nothing marked.
// Pure — the saving itself is ui/mosaic/progress-ui.js.
import { newMosaicPlay, mosaicFinished, givenMosaic, onlyGiven } from './play-core.js';

// Whether the player has done anything to the board as it opened.
function played(play, board) {
  return !onlyGiven(play, board);
}

// The board, row by row from the top left, a character a square — '0' clear, '1' shaded, '2' left
// blank, the table's dot — or '', nothing done to it since it opened, so it isn't started. A board
// the player cleared to nothing is its clear squares, so its 0s and 9s stay cleared.
export function boardSquares(play, board) {
  var chars = { blank: '2', shade: '1' };
  var squares = new Array(board.rows * board.cols).fill('0');
  Object.keys(play.marks).forEach(function (k) {
    var cell = k.split(',').map(Number);
    squares[cell[0] * board.cols + cell[1]] = chars[play.marks[k]];
  });
  return { true: squares.join(''), false: '' }[played(play, board)];
}

// The board's row: its hidden ID, its squares and whether it's finished. The database fills in who
// and when.
export function squaresRow(puzzle, play, board) {
  return { puzzle: puzzle, squares: boardSquares(play, board), finished: mosaicFinished(play, board) };
}

// What a pause saves: the board's row, if it isn't the row last saved — taps that come back to
// where they started, or a fill that did nothing, save nothing.
export function changedRows(row, last) {
  return [row].filter(function () { return row.squares !== last.squares || row.finished !== last.finished; });
}

// The board as it was left, from its saved rows — none, or an empty one, and it opens as a new board
// does, its 0s and 9s filled in. Only the board's own squares are read: anything past them, or any
// character but 1 and 2, marks nothing. Nothing is set off, so a board finished before doesn't
// celebrate again.
export function restoredMosaic(board, rows) {
  var saved = rows.slice(0, 1).filter(function (row) { return row.squares !== ''; });
  var play = { true: newMosaicPlay, false: function () { return givenMosaic(board); } }[saved.length > 0]();
  var marks = { 1: 'shade', 2: 'blank' };
  saved.forEach(function (row) {
    row.squares.slice(0, board.rows * board.cols).split('').forEach(function (ch, i) {
      [marks[ch]].filter(Boolean).forEach(function (mark) {
        play.marks[Math.floor(i / board.cols) + ',' + i % board.cols] = mark;
      });
    });
  });
  return play;
}

// What signing in saves of the board on screen: nothing, if the player hasn't done anything to it —
// they pick up the board saved elsewhere instead.
export function syncRows(puzzle, play, board) {
  return [squaresRow(puzzle, play, board)].filter(function () { return played(play, board); });
}

// Signing in mid-board: the board on screen kept if the player has done anything to it, else the
// board saved elsewhere.
export function joinedMosaic(play, saved, board) {
  return { true: { marks: play.marks, events: [] }, false: saved }[played(play, board)];
}

// Undo's history once the saved board is joined: kept with the squares on screen; gone once the
// saved board replaces them, as its taps were made elsewhere.
export function joinedMosaicHistory(play, history, board) {
  return { true: history, false: [] }[played(play, board)];
}
