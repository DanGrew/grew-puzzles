// Saved progress on the maze page: a signed-in player's place and finds are saved as the trail
// stops, and read back before the maze draws; signing in mid-maze syncs the maze on screen.
// Signed out, nothing is saved or read — not in this browser either — and the line under the
// checklist invites them to sign in. A save that fails is tried again until it lands, and once a
// retry has failed too the line says so. Every rule is core/maze/progress-core.js's, the line's
// and the finds' wait core/wordsearch/progress-core.js's, as a wordsearch's are; the client, and
// who is signed in, are ui/sign-in-ui.js's.
import { client, openSignIn } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import {
  savedRows, savedAnswer, queued, attempted, keptQueue, unsaved, becameSignedIn, saveLine
} from '../../core/wordsearch/progress-core.js';
import {
  moveRows, syncRows, restoredMaze, newPlace, placeMoved, placeDue, placeSending, placeSettled, keptPlace
} from '../../core/maze/progress-core.js';

var MAZE_PROGRESS_RETRY_MS = 2000;
// A place saved while a newer one waited sends that one at once; a failed one tries again later.
var MAZE_PLACE_WAITS = { true: 0, false: MAZE_PROGRESS_RETRY_MS };
var MAZE_PROGRESS_READS = { true: readMaze, false: newMaze };
var MAZE_PROGRESS_SAVES = { true: saveRows, false: function () {} };
var MAZE_PROGRESS_SYNCS = { true: sync, false: function () {} };
var queue = [];
var place = newPlace();
var signedIn = false;

function progressEl(id) {
  return document.getElementById(id);
}

// Hands then the maze with this hidden ID as it was left: what was saved, or new signed out or
// when it can't be read.
export function withSavedMaze(puzzle, board, then) {
  client.auth.getSession().then(function (answer) {
    signedIn = accountView(answer.data.session).signedIn;
    MAZE_PROGRESS_READS[signedIn](puzzle, board, then);
  }, function () { newMaze(puzzle, board, then); });
}

function readMaze(puzzle, board, then) {
  var reads = ['maze_position', 'maze_found'].map(function (table) {
    return client.from(table).select('cell_row, cell_col').eq('puzzle', puzzle).then(savedRows, function () { return []; });
  });
  Promise.all(reads).then(function (read) { then(restoredMaze(board, read[0], read[1])); });
}

function newMaze(puzzle, board, then) {
  then(restoredMaze(board, [], []));
}

// From here on, every change of who is signed in — the first look too — decides whether moves save
// and what the line under the checklist says. Signing in mid-maze syncs it: the maze on screen,
// current(), is saved, and the maze saved elsewhere is handed to onSaved to join it. Supabase asks
// that its own calls wait until its sign-in news has been handed round.
export function wireMazeProgress(puzzle, board, current, onSaved) {
  progressEl('save-sign-in').addEventListener('click', openSignIn);
  client.auth.onAuthStateChange(function (event, session) {
    var now = accountView(session).signedIn;
    var then = MAZE_PROGRESS_SYNCS[becameSignedIn(signedIn, now)];
    signedIn = now;
    queue = keptQueue(signedIn, queue);
    place = keptPlace(signedIn, place);
    showLine();
    setTimeout(function () { then(puzzle, board, current(), onSaved); }, 0);
  });
}

function sync(puzzle, board, play, onSaved) {
  saveRows(syncRows(puzzle, play, board));
  readMaze(puzzle, board, onSaved);
}

// What a move from before to after saves — signed in.
export function saveMove(puzzle, board, before, after) {
  MAZE_PROGRESS_SAVES[signedIn](moveRows(puzzle, before, after, board));
}

function saveRows(rows) {
  rows.place.forEach(function (row) {
    place = placeMoved(place, row);
    sendPlace();
  });
  rows.found.forEach(saveFound);
}

// Saving over: the place is the player's one row for this maze.
function sendPlace() {
  placeDue(place).forEach(function (row) {
    place = placeSending(place);
    client.from('maze_position').upsert(row)
      .then(savedAnswer, function () { return false; })
      .then(function (saved) { settlePlace(row, saved); });
  });
}

function settlePlace(row, saved) {
  place = placeSettled(place, row, saved);
  showLine();
  setTimeout(sendPlace, MAZE_PLACE_WAITS[saved]);
}

function saveFound(row) {
  queue = queued(queue, row);
  attemptFound(row);
}

// A find saved twice is refused as a duplicate, and counts as saved.
function attemptFound(row) {
  client.from('maze_found').insert(row)
    .then(savedAnswer, function () { return false; })
    .then(function (saved) { settleFound(row, saved); });
}

// A find still waiting when its retry comes round — the player hasn't signed out since — is tried
// again.
function settleFound(row, saved) {
  queue = attempted(queue, row, saved);
  showLine();
  unsaved(queue, row).forEach(function (waiting) {
    setTimeout(function () { unsaved(queue, waiting).forEach(attemptFound); }, MAZE_PROGRESS_RETRY_MS);
  });
}

function showLine() {
  var now = saveLine(signedIn, queue.concat([place]));
  progressEl('save-line').hidden = !now.shown;
  progressEl('save-hint').hidden = !now.hint;
  progressEl('save-note').hidden = !now.note;
}
