// Saved maze progress: what a move saves, and how a saved maze comes back. Two things are saved:
// the cell the player is on, saved over every time the trail stops somewhere new, and the cell of
// each thing found, saved once — a perfect maze's trail is the one route to that cell, so it is
// never stored (core/maze/play-core.js walks it again). The tables, and that a player reaches only
// their own rows, are grew-puzzles-tooling's docs/DATABASE.md; finished is worked out from the
// maze, never saved. A find waits to be saved, and is tried again, as a wordsearch's line does
// (core/wordsearch/progress-core.js); a place has its own one-slot wait below. Pure — the saving
// itself is ui/maze/progress-ui.js.
import { trailEnd, resumedMaze, foundCells } from './play-core.js';

// A saved row of either table: the maze's hidden ID and a cell. The database fills in who and when.
export function cellRow(puzzle, cell) {
  return { puzzle: puzzle, cell_row: cell[0], cell_col: cell[1] };
}

function rowCell(row) {
  return [row.cell_row, row.cell_col];
}

// What a move saves: the cell the trail now ends on, if it moved, and each thing found by it.
export function moveRows(puzzle, before, after, board) {
  var moved = String(trailEnd(before)) !== String(trailEnd(after));
  var fresh = foundCells({ got: after.got.filter(function (id) { return !before.got.includes(id); }) }, board);
  return {
    place: [cellRow(puzzle, trailEnd(after))].filter(function () { return moved; }),
    found: fresh.map(function (cell) { return cellRow(puzzle, cell); })
  };
}

// The maze as it was left, from its saved rows: the place, if one was saved — else the start —
// and the found cells.
export function restoredMaze(board, place, found) {
  var cell = place.map(rowCell).concat([board.start])[0];
  return resumedMaze(board, cell, found.map(rowCell));
}

// ---- Signing in mid-maze ----
// Signing in syncs the maze on screen, as a wordsearch does. A player who hasn't stirred from the
// start picks up where they left it — that's opening it on a new device. One who has keeps their
// place on screen, and saves it, and what they'd found elsewhere joins what they've found here.

function stirred(play) {
  return play.trail.length > 1 || play.got.length > 0;
}

// What signing in saves of the maze on screen: nothing, if the player hasn't stirred.
export function syncRows(puzzle, play, board) {
  var rows = { place: [cellRow(puzzle, trailEnd(play))], found: foundCells(play, board).map(function (cell) { return cellRow(puzzle, cell); }) };
  return { true: rows, false: { place: [], found: [] } }[stirred(play)];
}

// The play with the saved maze joined to it.
export function joinedMaze(play, saved) {
  var joining = saved.got.filter(function (id) { return !play.got.includes(id); });
  var joined = { trail: play.trail, got: play.got.concat(joining), events: [], locked: [], runs: play.runs };
  return { true: joined, false: saved }[stirred(play)];
}

// ---- The place waiting to be saved ----
// { row, failed, sending }: the latest place not yet saved — a newer one takes its place, so only
// where the player is now is ever sent, and one save at a time, so an older one never lands last —
// how many of its tries have failed, and whether one is on its way.

export function newPlace() {
  return { row: null, failed: 0, sending: false };
}

export function placeMoved(place, row) {
  return { row: row, failed: place.failed, sending: place.sending };
}

// The place to send now, if one is waiting and none is on its way.
export function placeDue(place) {
  return [place.row].filter(function (row) { return row !== null && !place.sending; });
}

export function placeSending(place) {
  return { row: place.row, failed: place.failed, sending: true };
}

// A save's answer: saved, the place leaves — unless a newer one came while it was on its way;
// failed, the place stays, a failure more, to be tried again.
export function placeSettled(place, row, saved) {
  var left = saved && place.row === row;
  return { row: { true: null, false: place.row }[left], failed: { true: 0, false: place.failed + 1 }[saved], sending: false };
}

// Signing out forgets the place: nothing is kept for a signed-out player.
export function keptPlace(signedIn, place) {
  return { true: place, false: newPlace() }[signedIn];
}
