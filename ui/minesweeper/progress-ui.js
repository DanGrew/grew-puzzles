// Saved progress on the minesweeper page: a signed-in player's marks — on a Reveal board, its opened
// squares and mine marks — are saved on every tap that changes them, and read back before the board
// draws; signing in mid-board syncs the board on
// screen. Signed out, nothing is saved or read — not in this browser either — and the line under the
// Mines card invites them to sign in. Only the newest marks are sent, one save at a time, and a save
// that fails is tried again until it lands; once a retry has failed too the line says so. Every rule
// is core/minesweeper/progress-core.js's, the wait core/maze/progress-core.js's and the line
// core/wordsearch/progress-core.js's, as a maze's are; the client, and who is signed in, are
// ui/sign-in-ui.js's.
import { client, openSignIn } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import { savedRows, savedAnswer, becameSignedIn, saveLine } from '../../core/wordsearch/progress-core.js';
import { newPlace, placeMoved, placeDue, placeSending, placeSettled, keptPlace } from '../../core/maze/progress-core.js';
import { tapRows, syncRows, restoredMines, revealTapRows, revealSyncRows, restoredReveal } from '../../core/minesweeper/progress-core.js';

var MINES_PROGRESS_RETRY_MS = 2000;
// A board's row by its rule, into the same table: a Vanilla board's marks, a Reveal board's opened
// squares and mine marks.
var MINES_ROWS = {
  vanilla: { tap: tapRows, sync: syncRows, restored: restoredMines },
  reveal: { tap: revealTapRows, sync: revealSyncRows, restored: restoredReveal }
};
// Marks saved while newer ones waited send those at once; a failed save tries again later.
var MINES_WAITS = { true: 0, false: MINES_PROGRESS_RETRY_MS };
var MINES_READS = { true: readBoard, false: newBoard };
var MINES_SAVES = { true: saveRows, false: function () {} };
var MINES_SYNCS = { true: sync, false: function () {} };
var waiting = newPlace();
var signedIn = false;

function progressEl(id) {
  return document.getElementById(id);
}

// Hands then the board with this hidden ID as it was left: what was saved, or new signed out or
// when it can't be read.
export function withSavedMines(puzzle, board, then) {
  client.auth.getSession().then(function (answer) {
    signedIn = accountView(answer.data.session).signedIn;
    MINES_READS[signedIn](puzzle, board, then);
  }, function () { newBoard(puzzle, board, then); });
}

function readBoard(puzzle, board, then) {
  client.from('mines_marks').select('mines, no_mines').eq('puzzle', puzzle)
    .then(savedRows, function () { return []; })
    .then(function (rows) { then(MINES_ROWS[board.rule].restored(board, rows)); });
}

function newBoard(puzzle, board, then) {
  then(MINES_ROWS[board.rule].restored(board, []));
}

// From here on, every change of who is signed in — the first look too — decides whether taps save
// and what the saved-progress line says. Signing in mid-board syncs it: the board on screen,
// current(), is saved, and the board saved elsewhere is handed to onSaved to join it. Supabase asks
// that its own calls wait until its sign-in news has been handed round.
export function wireMinesProgress(puzzle, board, current, onSaved) {
  progressEl('save-sign-in').addEventListener('click', openSignIn);
  client.auth.onAuthStateChange(function (event, session) {
    var now = accountView(session).signedIn;
    var then = MINES_SYNCS[becameSignedIn(signedIn, now)];
    signedIn = now;
    waiting = keptPlace(signedIn, waiting);
    showLine();
    setTimeout(function () { then(puzzle, board, current(), onSaved); }, 0);
  });
}

function sync(puzzle, board, play, onSaved) {
  saveRows(MINES_ROWS[board.rule].sync(puzzle, play, board));
  readBoard(puzzle, board, onSaved);
}

// What a tap from before to after saves — signed in.
export function saveTap(puzzle, board, before, after) {
  MINES_SAVES[signedIn](MINES_ROWS[board.rule].tap(puzzle, before, after, board));
}

function saveRows(rows) {
  rows.forEach(function (row) {
    waiting = placeMoved(waiting, row);
    sendMarks();
  });
}

// Saving over: the marks are the player's one row for this board.
function sendMarks() {
  placeDue(waiting).forEach(function (row) {
    waiting = placeSending(waiting);
    client.from('mines_marks').upsert(row)
      .then(savedAnswer, function () { return false; })
      .then(function (saved) { settleMarks(row, saved); });
  });
}

function settleMarks(row, saved) {
  waiting = placeSettled(waiting, row, saved);
  showLine();
  setTimeout(sendMarks, MINES_WAITS[saved]);
}

function showLine() {
  var now = saveLine(signedIn, [waiting]);
  progressEl('save-line').hidden = !now.shown;
  progressEl('save-hint').hidden = !now.hint;
  progressEl('save-note').hidden = !now.note;
}
