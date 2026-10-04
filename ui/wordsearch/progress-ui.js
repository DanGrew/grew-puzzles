// Saved progress on the play page: a signed-in player's finds are saved as they make them, and read
// back before the puzzle draws; signing in mid-puzzle syncs the puzzle on screen. Signed out,
// nothing is saved or read — not in this browser either — and the line under the words invites
// them to sign in. A save that fails is tried again until it lands, and once a retry has failed too
// the line says so. Every rule is core/wordsearch/progress-core.js's; the client, and who is signed
// in, are ui/sign-in-ui.js's.
import { client, openSignIn } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import {
  findRow, savedRows, restoredFinds, savedAnswer, queued, attempted, keptQueue, unsaved, becameSignedIn, saveLine
} from '../../core/wordsearch/progress-core.js';

var PROGRESS_RETRY_MS = 2000;
var PROGRESS_READS = { true: readFinds, false: noFinds };
var PROGRESS_SAVES = { true: save, false: function () {} };
var PROGRESS_SYNCS = { true: sync, false: function () {} };
var queue = [];
var signedIn = false;

function progressEl(id) {
  return document.getElementById(id);
}

// Hands then the words already found in the puzzle with this hidden ID, by index: what was saved, or
// nothing signed out or when it can't be read.
export function withSavedFinds(puzzle, words, then) {
  client.auth.getSession().then(function (answer) {
    signedIn = accountView(answer.data.session).signedIn;
    PROGRESS_READS[signedIn](puzzle, words, then);
  }, function () { then([]); });
}

function readFinds(puzzle, words, then) {
  client.from('progress').select('page, start_row, start_col, direction').eq('puzzle', puzzle).then(function (answer) {
    then(restoredFinds(savedRows(answer), words));
  }, function () { then([]); });
}

function noFinds(puzzle, words, then) {
  then([]);
}

// From here on, every change of who is signed in — the first look too — decides whether finds save
// and what the line under the words says. Signing in mid-puzzle syncs it: every find in found() is
// saved, and the finds saved for this puzzle elsewhere are handed to onSaved to join the board.
// Supabase asks that its own calls wait until its sign-in news has been handed round.
export function wireProgress(puzzle, words, found, onSaved) {
  progressEl('save-sign-in').addEventListener('click', openSignIn);
  client.auth.onAuthStateChange(function (event, session) {
    var now = accountView(session).signedIn;
    var then = PROGRESS_SYNCS[becameSignedIn(signedIn, now)];
    signedIn = now;
    queue = keptQueue(signedIn, queue);
    showLine();
    setTimeout(function () { then(puzzle, words, found(), onSaved); }, 0);
  });
}

function sync(puzzle, words, found, onSaved) {
  saveFinds(puzzle, words, found);
  readFinds(puzzle, words, onSaved);
}

// Each find in found, by index, saved — signed in.
export function saveFinds(puzzle, words, found) {
  found.forEach(function (i) { PROGRESS_SAVES[signedIn](findRow(puzzle, words[i])); });
}

function save(row) {
  queue = queued(queue, row);
  attempt(row);
}

function attempt(row) {
  client.from('progress').insert(row)
    .then(savedAnswer, function () { return false; })
    .then(function (saved) { settle(row, saved); });
}

function settle(row, saved) {
  queue = attempted(queue, row, saved);
  showLine();
  unsaved(queue, row).forEach(function (waiting) {
    setTimeout(function () { attempt(waiting); }, PROGRESS_RETRY_MS);
  });
}

function showLine() {
  var now = saveLine(signedIn, queue);
  progressEl('save-line').hidden = !now.shown;
  progressEl('save-hint').hidden = !now.hint;
  progressEl('save-note').hidden = !now.note;
}
