// Saved minesweeper progress: what a tap saves, and how a saved board comes back. A board is one
// row, saved over on every tap that changes the marks — the whole mark set, the squares marked as a
// mine and those marked as no mine, never one row per tap — and whether it is finished. The table,
// and that a player reaches only their own row, are grew-puzzles-tooling's docs/DATABASE.md. Only
// the newest marks are ever sent, one save at a time, so the last tap always wins: the one-slot wait
// is core/maze/progress-core.js's, as a maze's place is. Pure — the saving itself is
// ui/minesweeper/progress-ui.js.
import { minesFinished, newMinesPlay, keyOf } from './play-core.js';
import { newRevealPlay, revealFinished } from './reveal-core.js';

function cellOf(key) {
  return key.split(',').map(Number);
}

// The squares given a mark, row by row, as [row, col].
function cellsMarked(play, mark) {
  return Object.keys(play.marks).filter(function (k) { return play.marks[k] === mark; }).map(cellOf)
    .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
}

// The board's row: its hidden ID, its marks and whether it's finished. The database fills in who
// and when.
export function marksRow(puzzle, play, board) {
  return { puzzle: puzzle, mines: cellsMarked(play, 'mine'), no_mines: cellsMarked(play, 'dot'), finished: minesFinished(play, board) };
}

// What a tap saves: the board's row, if the tap changed the marks — a red number's tap, or one on a
// solved board, saves nothing.
export function tapRows(puzzle, before, after, board) {
  var row = marksRow(puzzle, after, board);
  return [row].filter(function () { return JSON.stringify(marksRow(puzzle, before, board)) !== JSON.stringify(row); });
}

// A saved square is marked only if it is one of the board's blank squares — a saved mark that isn't
// marks nothing. The database already refuses anything but whole, unsigned [row, col] pairs.
function blankSquare(cell, board) {
  return cell[0] < board.rows && cell[1] < board.cols && !(cell.join(',') in board.numbers);
}

// The board as it was left, from its saved rows — none, and it's new; a row always has both lists,
// empty at the least. Nothing is set off, so a board finished before doesn't celebrate again.
export function restoredMines(board, rows) {
  var play = newMinesPlay();
  rows.slice(0, 1).forEach(function (row) {
    [['no_mines', 'dot'], ['mines', 'mine']].forEach(function (list) {
      row[list[0]].filter(function (cell) { return blankSquare(cell, board); }).forEach(function (cell) { play.marks[cell.join(',')] = list[1]; });
    });
  });
  return play;
}

// ---- Signing in mid-board ----
// Signing in syncs the board on screen, as a maze does. A player who hasn't marked anything picks up
// the board saved elsewhere — that's opening it on a new device. One who has keeps the marks on
// screen, and saves them.

function marked(play) {
  return Object.keys(play.marks).length > 0;
}

// What signing in saves of the board on screen: nothing, if the player hasn't marked anything.
export function syncRows(puzzle, play, board) {
  return [marksRow(puzzle, play, board)].filter(function () { return marked(play); });
}

// The play once the saved board is joined to it: the marks on screen, if there are any, else the
// saved board's.
export function joinedMines(play, saved) {
  return { true: { marks: play.marks, events: [] }, false: saved }[marked(play)];
}

// Undo's history once the saved board is joined: kept with the marks on screen; gone once the
// saved board replaces them, as its taps were made elsewhere.
export function joinedHistory(play, history) {
  return { true: history, false: [] }[marked(play)];
}

// ---- A Reveal board ----
// The same table, the same one row (the product's TASK-174): its opened squares in no_mines — a
// Reveal board's opened squares are its proven-safe ones — and its mine marks in mines, in the order
// they were placed, so a Limited Flags board's oldest mark is known on any device (the product's
// TASK-179). Only a Reveal board's own page reads them, so they never mean dots to a Vanilla one. A
// kaboom saves the row empty, so the board comes back at its start.

function keysCells(keys) {
  return keys.map(cellOf).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
}

// The board's row: its hidden ID, its mine marks, oldest first, its opened squares row by row and
// whether it's finished — or,
// once a mine has gone off, empty.
export function revealRow(puzzle, play, board) {
  var live = play.boom === '';
  return {
    puzzle: puzzle,
    mines: Object.keys(play.marks).filter(function () { return live; }).map(cellOf),
    no_mines: keysCells(Object.keys(play.open).filter(function () { return live; })),
    finished: live && revealFinished(play, board)
  };
}

// What a tap saves: the board's row, if the tap changed it — a tap that opens nothing and marks
// nothing saves nothing.
export function revealTapRows(puzzle, before, after, board) {
  var row = revealRow(puzzle, after, board);
  return [row].filter(function () { return JSON.stringify(revealRow(puzzle, before, board)) !== JSON.stringify(row); });
}

function onBoard(cell, board) {
  return cell[0] < board.rows && cell[1] < board.cols;
}

// The board as it was left, from its saved rows — none, or an empty one, and it's at its start. A
// saved open square opens only if it isn't a mine, and a saved mark lands only on a square still
// covered. A finished board comes back finished, its mines marked as the finish marks them, and
// nothing is set off, so it doesn't celebrate again.
export function restoredReveal(board, rows) {
  var play = newRevealPlay(board);
  rows.slice(0, 1).forEach(function (row) {
    row.no_mines.filter(function (cell) { return onBoard(cell, board) && !board.mines.includes(keyOf(cell)); })
      .forEach(function (cell) { play.open[keyOf(cell)] = true; });
    row.mines.filter(function (cell) { return onBoard(cell, board) && !play.open[keyOf(cell)]; })
      .forEach(function (cell) { play.marks[keyOf(cell)] = 'mine'; });
  });
  return { open: play.open, marks: finishedMarks(play, board), boom: '', events: [] };
}

function finishedMarks(play, board) {
  var all = Object.fromEntries(board.mines.map(function (k) { return [k, 'mine']; }));
  return { true: all, false: play.marks }[revealFinished(play, board)];
}

// Played: anything marked, or opened past the start square's area — and no mine gone off.
function revealPlayed(play, board) {
  var opened = Object.keys(play.open).length > Object.keys(newRevealPlay(board).open).length;
  return play.boom === '' && (opened || Object.keys(play.marks).length > 0);
}

// What signing in saves of the board on screen: nothing, if the player hasn't played it.
export function revealSyncRows(puzzle, play, board) {
  return [revealRow(puzzle, play, board)].filter(function () { return revealPlayed(play, board); });
}

// The play once the saved board is joined to it: the board on screen, if it's been played, else the
// saved board.
export function joinedReveal(play, saved, board) {
  return { true: { open: play.open, marks: play.marks, boom: '', events: [] }, false: saved }[revealPlayed(play, board)];
}

// Undo's history once the saved board is joined, as joinedHistory's.
export function joinedRevealHistory(play, history, board) {
  return { true: history, false: [] }[revealPlayed(play, board)];
}
