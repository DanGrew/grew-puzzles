// Saved progress on the mosaic page: a signed-in player's squares are saved once they pause in
// tapping — and at once when the page is hidden or left, in a way that lands even once it's gone —
// and read back before the board draws;
// signing in mid-board syncs the board on screen. A big board is 40,000 squares, so it waits for a
// pause rather than going on every tap (the product's TASK-167 spec), and nothing waits on a save while
// the player taps. Signed out, nothing is saved or read — not in this browser either — and the line
// under the Squares card invites them to sign in. Only the newest board is sent, one save at a time,
// and a save that fails is tried again until it lands; once a retry has failed too the line says so.
// Every rule is core/mosaic/progress-core.js's, the wait core/maze/progress-core.js's and the line
// core/wordsearch/progress-core.js's, as a minesweeper board's are; the client, and who is signed in,
// are ui/sign-in-ui.js's.
import { client, openSignIn, saveKept } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import { savedRows, becameSignedIn, saveLine } from '../../core/wordsearch/progress-core.js';
import { newPlace, placeMoved, placeDue, placeSending, placeSettled, keptPlace } from '../../core/maze/progress-core.js';
import { squaresRow, changedRows, restoredMosaic, syncRows } from '../../core/mosaic/progress-core.js';

var MOSAIC_PROGRESS_RETRY_MS = 2000;
// How long tapping stops before the board is saved.
var MOSAIC_SAVE_PAUSE_MS = 600;
// A board saved while a newer one waited sends that at once; a failed save tries again later.
var MOSAIC_WAITS = { true: 0, false: MOSAIC_PROGRESS_RETRY_MS };
var MOSAIC_READS = { true: readBoard, false: newBoard };
var MOSAIC_TAPS = { true: tappedSignedIn, false: function () {} };
var MOSAIC_SYNCS = { true: sync, false: function () {} };
var MOSAIC_LEAVES = { hidden: saveNow, visible: function () {} };
var waiting = newPlace();
var signedIn = false;
// The board as last handed to be saved, and the rows the board waiting for the pause to end saves.
var last = { squares: '', finished: false };
var due = function () { return []; };
var pause = 0;

function progressEl(id) {
  return document.getElementById(id);
}

// Hands then the board with this hidden ID as it was left: what was saved, or new signed out or
// when it can't be read.
export function withSavedMosaic(puzzle, board, then) {
  client.auth.getSession().then(function (answer) {
    signedIn = accountView(answer.data.session).signedIn;
    MOSAIC_READS[signedIn](puzzle, board, then);
  }, function () { newBoard(puzzle, board, then); });
}

function readBoard(puzzle, board, then) {
  client.from('mosaic_squares').select('squares').eq('puzzle', puzzle)
    .then(savedRows, function () { return []; })
    .then(function (rows) { handBack(puzzle, board, restoredMosaic(board, rows), then); });
}

function newBoard(puzzle, board, then) {
  handBack(puzzle, board, restoredMosaic(board, []), then);
}

// The board read back is the board saved: a pause after it saves only what changed since.
function handBack(puzzle, board, play, then) {
  last = squaresRow(puzzle, play, board);
  then(play);
}

// From here on, every change of who is signed in — the first look too — decides whether taps save
// and what the saved-progress line says. Signing in mid-board syncs it: the board on screen,
// current(), is saved, and the board saved elsewhere is handed to onSaved to join it. Hiding or
// leaving the page saves a board still waiting for its pause. Supabase asks that its own calls wait
// until its sign-in news has been handed round.
export function wireMosaicProgress(puzzle, board, current, onSaved) {
  progressEl('save-sign-in').addEventListener('click', openSignIn);
  document.addEventListener('visibilitychange', function () { MOSAIC_LEAVES[document.visibilityState](); });
  window.addEventListener('pagehide', saveNow);
  client.auth.onAuthStateChange(function (event, session) {
    var now = accountView(session).signedIn;
    var then = MOSAIC_SYNCS[becameSignedIn(signedIn, now)];
    signedIn = now;
    waiting = keptPlace(signedIn, waiting);
    clearTimeout(pause);
    due = function () { return []; };
    showLine();
    setTimeout(function () { then(puzzle, board, current(), onSaved); }, 0);
  });
}

function sync(puzzle, board, play, onSaved) {
  saveRows(syncRows(puzzle, play, board));
  readBoard(puzzle, board, onSaved);
}

// The board after a tap or an Undo — signed in, saved once tapping pauses.
export function mosaicTapped(puzzle, board, play) {
  MOSAIC_TAPS[signedIn](puzzle, board, play);
}

function tappedSignedIn(puzzle, board, play) {
  clearTimeout(pause);
  due = function () { return changedRows(squaresRow(puzzle, play, board), last); };
  pause = setTimeout(saveNow, MOSAIC_SAVE_PAUSE_MS);
}

// The rows of the board waiting for its pause, which waits no more.
function dueNow() {
  var rows = due();
  clearTimeout(pause);
  due = function () { return []; };
  return rows;
}

function saveNow() {
  saveRows(dueNow());
}

function saveRows(rows) {
  rows.forEach(function (row) {
    last = row;
    waiting = placeMoved(waiting, row);
    sendSquares();
  });
}

// Saving over: the squares are the player's one row for this mosaic — sent so a save on its way
// lands even if the page is left.
function sendSquares() {
  placeDue(waiting).forEach(function (row) {
    waiting = placeSending(waiting);
    saveKept('mosaic_squares', row).then(function (saved) { settleSquares(row, saved); });
  });
}

function settleSquares(row, saved) {
  waiting = placeSettled(waiting, row, saved);
  showLine();
  setTimeout(sendSquares, MOSAIC_WAITS[saved]);
}

function showLine() {
  var now = saveLine(signedIn, [waiting]);
  progressEl('save-line').hidden = !now.shown;
  progressEl('save-hint').hidden = !now.hint;
  progressEl('save-note').hidden = !now.note;
}
