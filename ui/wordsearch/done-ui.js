// Done ticks on the landing and collection pages: signed in, every tile whose puzzles the player has
// finished — wordsearches and mazes alike — wears a ✓. The tiles draw first and never wait — the
// ticks arrive once the player's saved lines and maze finds are read and the files of the puzzles
// they've started are opened. Signed out, nothing is read and no tile changes; a read that fails
// ticks nothing it can't be sure of. The same read hands the landing page the started wordsearches
// still in play, most recent first, for its Continue playing rail. Every rule is
// core/wordsearch/done-core.js's, a maze's finished core/maze/done-core.js's; the client, and who
// is signed in, are ui/sign-in-ui.js's.
import { client } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import { playJson } from '../../core/wordsearch/play-core.js';
import { savedRows } from '../../core/wordsearch/progress-core.js';
import {
  readRange, morePages, startedPuzzles, puzzleFile, donePuzzles, playingPuzzles, tileDone,
} from '../../core/wordsearch/done-core.js';
import { mazeFile } from '../../core/maze/play-core.js';
import { doneMazes } from '../../core/maze/done-core.js';

var DONE_LOOKUPS = { true: lookUp, false: none };
var DONE_READS = { true: readFrom, false: function (source, n, rows, then) { then(rows); } };
// What's read for the ticks: every saved line, and every maze find, each in one fixed order.
var DONE_SOURCES = [
  { table: 'progress', columns: 'puzzle, page, start_row, start_col, direction, found_at', order: ['puzzle', 'page', 'start_row', 'start_col', 'direction'] },
  { table: 'maze_found', columns: 'puzzle, cell_row, cell_col', order: ['puzzle', 'cell_row', 'cell_col'] }
];
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
  Promise.all(DONE_SOURCES.map(function (source) {
    return new Promise(function (read) { readFrom(source, 0, [], read); });
  })).then(function (read) {
    var lines = read[0], finds = read[1];
    var started = startedPuzzles(lines, tiles), mazes = startedPuzzles(finds, tiles);
    Promise.all([Promise.allSettled(started.map(openPuzzle)), Promise.allSettled(mazes.map(openMaze))]).then(function (opened) {
      var done = donePuzzles(lines, started, opened[0]);
      DONE_HANDS[mine === asked](then, {
        done: done.concat(doneMazes(finds, mazes, opened[1])), playing: playingPuzzles(lines, started, opened[0], done), signedIn: true
      });
    });
  });
}

// Every one of the player's rows in a source's table, a page at a time, in its fixed order. The
// database hands each player only their own rows.
function readFrom(source, n, rows, then) {
  var range = readRange(n);
  source.order.reduce(function (query, column) { return query.order(column); }, client.from(source.table).select(source.columns))
    .range(range[0], range[1])
    .then(function (answer) {
      var read = savedRows(answer);
      DONE_READS[morePages(read, range)](source, n + 1, rows.concat(read), then);
    }, function () { then(rows); });
}

function openPuzzle(hiddenId) {
  return fetch(puzzleFile(hiddenId)).then(playJson);
}

function openMaze(hiddenId) {
  return fetch(mazeFile(hiddenId)).then(playJson);
}

// A tile's ✓, on or off, for the puzzles finished so far.
export function paintDone(a, tile, done) {
  a.dataset.done = String(tileDone(tile, done));
}
