// Saved progress on the criss-cross page: a signed-in player's words are saved each time one goes
// in, comes out or moves, and read back before the shape draws; signing in mid-shape syncs the shape
// on screen. Signed out, nothing is saved or read — not in this browser either — and the line under
// the Words card invites them to sign in. Only the newest words are sent, one save at a time, and a
// save that fails is tried again until it lands; once a retry has failed too the line says so. Every
// rule is core/crisscross/progress-core.js's, the wait core/maze/progress-core.js's and the line
// core/wordsearch/progress-core.js's, as a minesweeper board's are; the client, and who is signed
// in, are ui/sign-in-ui.js's.
import { client, openSignIn } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import { savedRows, savedAnswer, becameSignedIn, saveLine } from '../../core/wordsearch/progress-core.js';
import { newPlace, placeMoved, placeDue, placeSending, placeSettled, keptPlace } from '../../core/maze/progress-core.js';
import { tapRows, syncRows, restoredCriss } from '../../core/crisscross/progress-core.js';

var CRISS_PROGRESS_RETRY_MS = 2000;
// Words saved while newer ones waited send those at once; a failed save tries again later.
var CRISS_WAITS = { true: 0, false: CRISS_PROGRESS_RETRY_MS };
var CRISS_READS = { true: readShape, false: newShape };
var CRISS_SAVES = { true: saveRows, false: function () {} };
var CRISS_SYNCS = { true: sync, false: function () {} };
var waiting = newPlace();
var signedIn = false;

function progressEl(id) {
  return document.getElementById(id);
}

// Hands then the shape with this hidden ID as it was left: what was saved, or new signed out or
// when it can't be read.
export function withSavedCriss(puzzle, board, then) {
  client.auth.getSession().then(function (answer) {
    signedIn = accountView(answer.data.session).signedIn;
    CRISS_READS[signedIn](puzzle, board, then);
  }, function () { newShape(puzzle, board, then); });
}

function readShape(puzzle, board, then) {
  client.from('criss_words').select('words').eq('puzzle', puzzle)
    .then(savedRows, function () { return []; })
    .then(function (rows) { then(restoredCriss(board, rows)); });
}

function newShape(puzzle, board, then) {
  then(restoredCriss(board, []));
}

// From here on, every change of who is signed in — the first look too — decides whether words save
// and what the saved-progress line says. Signing in mid-shape syncs it: the shape on screen,
// current(), is saved, and the shape saved elsewhere is handed to onSaved to join it. Supabase asks
// that its own calls wait until its sign-in news has been handed round.
export function wireCrissProgress(puzzle, board, current, onSaved) {
  progressEl('save-sign-in').addEventListener('click', openSignIn);
  client.auth.onAuthStateChange(function (event, session) {
    var now = accountView(session).signedIn;
    var then = CRISS_SYNCS[becameSignedIn(signedIn, now)];
    signedIn = now;
    waiting = keptPlace(signedIn, waiting);
    showLine();
    setTimeout(function () { then(puzzle, board, current(), onSaved); }, 0);
  });
}

function sync(puzzle, board, play, onSaved) {
  saveRows(syncRows(puzzle, play, board));
  readShape(puzzle, board, onSaved);
}

// What a tap from before to after saves — signed in.
export function saveTap(puzzle, board, before, after) {
  CRISS_SAVES[signedIn](tapRows(puzzle, before, after, board));
}

function saveRows(rows) {
  rows.forEach(function (row) {
    waiting = placeMoved(waiting, row);
    sendWords();
  });
}

// Saving over: the words are the player's one row for this shape.
function sendWords() {
  placeDue(waiting).forEach(function (row) {
    waiting = placeSending(waiting);
    client.from('criss_words').upsert(row)
      .then(savedAnswer, function () { return false; })
      .then(function (saved) { settleWords(row, saved); });
  });
}

function settleWords(row, saved) {
  waiting = placeSettled(waiting, row, saved);
  showLine();
  setTimeout(sendWords, CRISS_WAITS[saved]);
}

function showLine() {
  var now = saveLine(signedIn, [waiting]);
  progressEl('save-line').hidden = !now.shown;
  progressEl('save-hint').hidden = !now.hint;
  progressEl('save-note').hidden = !now.note;
}
