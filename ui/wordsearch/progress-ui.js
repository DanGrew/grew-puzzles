// Saved progress on the play page: a signed-in player's finds are saved as they make them, and read
// back before the puzzle draws. Signed out, nothing is saved or read — not in this browser either —
// and the line under the words invites them to sign in. A save that fails is tried again until it
// lands, and once a retry has failed too the line says so. Every rule is
// core/wordsearch/progress-core.js's; the client, and who is signed in, are ui/sign-in-ui.js's.
import { client } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import {
  findRow, savedRows, restoredFinds, savedAnswer, queued, attempted, keptQueue, unsaved, saveLine
} from '../../core/wordsearch/progress-core.js';

var PROGRESS_RETRY_MS = 2000;
var PROGRESS_READS = { true: readFinds, false: noFinds };
var PROGRESS_SAVES = { true: save, false: function () {} };
var queue = [];
var signedIn = false;
var line;

// Hands then the words already found in the puzzle with this hidden ID, by index: what was saved, or
// nothing signed out or when it can't be read.
export function withSavedFinds(puzzle, words, then) {
  client.auth.getSession().then(function (answer) {
    PROGRESS_READS[accountView(answer.data.session).signedIn](puzzle, words, then);
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
// and what the line under the words says.
export function wireProgress(lineEl) {
  line = lineEl;
  client.auth.onAuthStateChange(function (event, session) {
    signedIn = accountView(session).signedIn;
    queue = keptQueue(signedIn, queue);
    showLine();
  });
}

// Each find just made in the puzzle with this hidden ID, saved — signed in.
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
  line.textContent = now.text;
  line.hidden = !now.shown;
}
