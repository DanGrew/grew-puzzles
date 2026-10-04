// Done ticks on the landing and collection pages: signed in, every tile whose puzzles the player has
// finished wears a ✓. The tiles draw first and never wait — the ticks arrive once the player's saved
// lines are read and the files of the puzzles they've started are opened. Signed out, nothing is
// read and no tile changes; a read that fails ticks nothing it can't be sure of. Every rule is
// core/wordsearch/done-core.js's; the client, and who is signed in, are ui/sign-in-ui.js's.
import { client } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import { playJson } from '../../core/wordsearch/play-core.js';
import { savedRows } from '../../core/wordsearch/progress-core.js';
import { readRange, morePages, startedPuzzles, puzzleFile, donePuzzles, tileDone } from '../../core/wordsearch/done-core.js';

var DONE_LOOKUPS = { true: lookUp, false: function () {} };
var DONE_READS = { true: readFrom, false: function (n, rows, then) { then(rows); } };

// Hands then the hidden IDs of the finished puzzles the tiles stand for — signed in only.
export function withDone(tiles, then) {
  client.auth.getSession().then(function (answer) {
    DONE_LOOKUPS[accountView(answer.data.session).signedIn](tiles, then);
  }, function () {});
}

function lookUp(tiles, then) {
  readFrom(0, [], function (rows) {
    var started = startedPuzzles(rows, tiles);
    Promise.allSettled(started.map(openPuzzle)).then(function (opened) {
      then(donePuzzles(rows, started, opened));
    });
  });
}

// Every one of the player's saved lines, a page at a time, in one fixed order. The database hands
// each player only their own rows.
function readFrom(n, rows, then) {
  var range = readRange(n);
  client.from('progress').select('puzzle, page, start_row, start_col, direction')
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
