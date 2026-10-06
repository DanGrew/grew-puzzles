// Done ticks on the landing and collection pages: signed in, every tile whose puzzles the player has
// finished wears a ✓. The tiles draw first and never wait — the ticks arrive once the player's saved
// lines are read and the files of the puzzles they've started are opened. Signed out, nothing is
// read and no tile changes; a read that fails ticks nothing it can't be sure of. The same read
// hands the landing page the started puzzles still in play, most recent first, for its Continue
// playing rail. Every rule is core/wordsearch/done-core.js's; the client, and who is signed in, are
// ui/sign-in-ui.js's.
import { client } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import { playJson } from '../../core/wordsearch/play-core.js';
import { savedRows } from '../../core/wordsearch/progress-core.js';
import {
  readRange, morePages, startedPuzzles, puzzleFile, donePuzzles, playingPuzzles, tileDone,
} from '../../core/wordsearch/done-core.js';

var DONE_LOOKUPS = { true: lookUp, false: none };
var DONE_READS = { true: readFrom, false: function (n, rows, then) { then(rows); } };
var DONE_HANDS = { true: function (then, progress) { then(progress); }, false: function () {} };
// Each look-up is numbered: only the latest one's answer is handed on, so a slow read that lands
// after the player has signed out never ticks a tile.
var asked = 0;

// From here on, every change of who is signed in — the first look too — hands then the player's
// progress over the puzzles the tiles stand for, by hidden ID: done, those finished, and playing,
// those started and not, most recently played first — and signedIn, whether anyone is. Signing in
// brings the ticks and the rail, signing out takes them all away. Supabase asks that its own calls wait until its sign-in news has been handed round.
export function wireDone(tiles, then) {
  client.auth.onAuthStateChange(function (event, session) {
    var signedIn = accountView(session).signedIn;
    setTimeout(function () { DONE_LOOKUPS[signedIn](tiles, then); }, 0);
  });
}

// The same, once, for whoever is signed in now — a page brought back from the browser's cache.
export function withDone(tiles, then) {
  client.auth.getSession().then(function (answer) {
    DONE_LOOKUPS[accountView(answer.data.session).signedIn](tiles, then);
  }, function () {});
}

function none(tiles, then) {
  asked += 1;
  then({ done: [], playing: [], signedIn: false });
}

function lookUp(tiles, then) {
  asked += 1;
  var mine = asked;
  readFrom(0, [], function (rows) {
    var started = startedPuzzles(rows, tiles);
    Promise.allSettled(started.map(openPuzzle)).then(function (opened) {
      var done = donePuzzles(rows, started, opened);
      DONE_HANDS[mine === asked](then, { done: done, playing: playingPuzzles(rows, started, opened, done), signedIn: true });
    });
  });
}

// Every one of the player's saved lines, and when each was found, a page at a time, in one fixed
// order. The database hands each player only their own rows.
function readFrom(n, rows, then) {
  var range = readRange(n);
  client.from('progress').select('puzzle, page, start_row, start_col, direction, found_at')
    .order('puzzle').order('page').order('start_row').order('start_col').order('direction')
    .range(range[0], range[1])
    .then(function (answer) {
      var read = savedRows(answer);
      DONE_READS[morePages(read, range)](n + 1, rows.concat(read), then);
    }, function () { then(rows); });
}

function openPuzzle(hiddenId) {
  return fetch(puzzleFile(hiddenId)).then(playJson);
}

// A tile's ✓, on or off, for the puzzles finished so far.
export function paintDone(a, tile, done) {
  a.dataset.done = String(tileDone(tile, done));
}
