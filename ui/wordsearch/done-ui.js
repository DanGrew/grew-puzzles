// Done ticks on the landing and collection pages, and the Scorecard's boxes: signed in, every tile whose puzzles the player has
// finished — wordsearches, mazes, minesweeper boards, criss-crosses and mosaics alike — wears a ✓,
// and a finished mosaic's tile reads its picture's name. The tiles
// draw first and never wait — the ticks arrive once the player's saved lines, maze places, maze
// finds, boards' marks, criss-crosses' words and started mosaics are read and the files of the
// wordsearches and mazes they've started, and the mosaics they've finished, are opened; a board's
// marks, a criss-cross's words and a mosaic's row say themselves whether it's finished. Signed out,
// nothing is read and no tile changes; a read
// that fails ticks nothing it can't be sure of. The same read hands the landing page the started
// puzzles still in play, every kind together, most recently played first, for its Continue playing
// rail. Every rule is core/wordsearch/done-core.js's, a maze's core/maze/done-core.js's, a board's
// core/minesweeper/done-core.js's, a criss-cross's core/crisscross/done-core.js's, a mosaic's
// core/mosaic/done-core.js's; the client, and who is signed in, are ui/sign-in-ui.js's.
import { client } from '../sign-in-ui.js';
import { accountView } from '../../core/auth-core.js';
import { playJson } from '../../core/wordsearch/play-core.js';
import { savedRows } from '../../core/wordsearch/progress-core.js';
import {
  readRange, morePages, startedPuzzles, puzzleFile, donePuzzles, playingPuzzles, lastPlayed, railOrder, tileDone, tileName,
} from '../../core/wordsearch/done-core.js';
import { mazeFile } from '../../core/maze/play-core.js';
import { doneMazes, playingMazes, mazeLastPlayed } from '../../core/maze/done-core.js';
import { doneBoards, playingBoards } from '../../core/minesweeper/done-core.js';
import { doneShapes, playingShapes } from '../../core/crisscross/done-core.js';
import { mosaicFile } from '../../core/mosaic/play-core.js';
import { doneMosaics, playingMosaics, mosaicNames } from '../../core/mosaic/done-core.js';

var DONE_LOOKUPS = { true: lookUp, false: none };
var DONE_READS = { true: readFrom, false: function (source, n, rows, then) { then(rows); } };
var everyRow = function (query) { return query; };
// What's read for the ticks and the rail: every saved line, every maze find, every maze place,
// every board's marks, every criss-cross's words and every started mosaic, each in one fixed order.
// A mosaic's squares are never read — a 200×200's are 40 KB — only whether it's finished and when it
// was tapped, of the rows with a square marked.
var DONE_SOURCES = [
  { table: 'progress', columns: 'puzzle, page, start_row, start_col, direction, found_at', order: ['puzzle', 'page', 'start_row', 'start_col', 'direction'], rows: everyRow },
  { table: 'maze_found', columns: 'puzzle, cell_row, cell_col, found_at', order: ['puzzle', 'cell_row', 'cell_col'], rows: everyRow },
  { table: 'maze_position', columns: 'puzzle, cell_row, cell_col, moved_at', order: ['puzzle'], rows: everyRow },
  { table: 'mines_marks', columns: 'puzzle, mines, no_mines, finished, tapped_at', order: ['puzzle'], rows: everyRow },
  { table: 'criss_words', columns: 'puzzle, words, finished, placed_at', order: ['puzzle'], rows: everyRow },
  { table: 'mosaic_squares', columns: 'puzzle, finished, tapped_at', order: ['puzzle'], rows: function (query) { return query.neq('squares', ''); } }
];
var DONE_HANDS = { true: function (then, progress) { then(progress); }, false: function () {} };
// Each look-up is numbered: only the latest one's answer is handed on, so a slow read that lands
// after the player has signed out never ticks a tile.
var asked = 0;

// From here on, every change of who is signed in — the first look too — hands then the player's
// progress over the puzzles the tiles stand for, by hidden ID: done, those finished, playing,
// those started and not, most recently played first, names, each finished mosaic's picture's name —
// and signedIn, whether anyone is. Signing in
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
  then({ done: [], playing: [], names: {}, signedIn: false });
}

function lookUp(tiles, then) {
  asked += 1;
  var mine = asked;
  Promise.all(DONE_SOURCES.map(function (source) {
    return new Promise(function (read) { readFrom(source, 0, [], read); });
  })).then(function (read) {
    var lines = read[0], finds = read[1], places = read[2], boards = read[3], shapes = read[4], mosaics = read[5];
    var boardsDone = doneBoards(boards, tiles), shapesDone = doneShapes(shapes, tiles), mosaicsDone = doneMosaics(mosaics, tiles);
    var started = startedPuzzles(lines, tiles), mazes = startedPuzzles(finds.concat(places), tiles);
    Promise.all([Promise.allSettled(started.map(openPuzzle)), Promise.allSettled(mazes.map(openMaze)), Promise.allSettled(mosaicsDone.map(openMosaic))]).then(function (opened) {
      var done = donePuzzles(lines, started, opened[0]), mazesDone = doneMazes(finds, mazes, opened[1]);
      var playing = playingPuzzles(lines, started, opened[0], done).concat(playingMazes(places, finds, mazes, opened[1], mazesDone), playingBoards(boards, tiles, boardsDone), playingShapes(shapes, tiles, shapesDone), playingMosaics(mosaics, tiles, mosaicsDone));
      var lasts = [lastPlayed(lines, 'found_at'), mazeLastPlayed(places, finds), lastPlayed(boards, 'tapped_at'), lastPlayed(shapes, 'placed_at'), lastPlayed(mosaics, 'tapped_at')];
      DONE_HANDS[mine === asked](then, { done: done.concat(mazesDone, boardsDone, shapesDone, mosaicsDone), playing: railOrder(playing, lasts), names: mosaicNames(mosaicsDone, opened[2]), signedIn: true });
    });
  });
}

// Every one of the player's rows in a source's table, a page at a time, in its fixed order. The
// database hands each player only their own rows.
function readFrom(source, n, rows, then) {
  var range = readRange(n);
  source.order.reduce(function (query, column) { return query.order(column); }, source.rows(client.from(source.table).select(source.columns)))
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

function openMosaic(hiddenId) {
  return fetch(mosaicFile(hiddenId)).then(playJson);
}

// A tile's ✓, on or off, for the puzzles finished so far, and what it reads — a finished mosaic's
// name, by names, else its title.
export function paintDone(a, tile, done, names) {
  a.dataset.done = String(tileDone(tile, done));
  a.querySelector('.name').textContent = tileName(tile, names);
}
