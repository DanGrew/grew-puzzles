// The play page's rules: which puzzle a play URL names, where each word sits, what a tap
// does, and what the board shows. Pure — the DOM work is ui/wordsearch/play-ui.js. The
// puzzle file and the play URL are grew-puzzles-tooling's docs/PUZZLE-FORMAT.md. An ES module:
// the page imports it through ui/, and the unit tests import it directly.
import { dayLabel } from '../day-core.js';

var PLAY_RING_KINDS = { 1: 'select', 2: 'wrong' };

// ---- Finding the puzzle ----

// The play URL names a wordsearch by its hidden ID — play.html?id=WSCH-0003 — and its file
// carries that name. Anything else names no puzzle, so it never becomes a path.
export function puzzleUrl(search) {
  var id = new URLSearchParams(search).get('id');
  if (!/^WSCH-[0-9]{4,}$/.test(id)) throw new Error('No such puzzle');
  return '../content/puzzles/wordsearch/' + id + '.json';
}

export function playJson(response) {
  if (!response.ok) throw new Error('No such puzzle');
  return response.json();
}

// ---- The board ----

export function wordCells(word) {
  var step = { N: [-1, 0], NE: [-1, 1], E: [0, 1], SE: [1, 1], S: [1, 0], SW: [1, -1], W: [0, -1], NW: [-1, -1] }[word.direction];
  return Array.from({ length: word.length }, function (_, i) {
    return [word.start.row + step[0] * i, word.start.col + step[1] * i];
  });
}

// The type is the board's only label: shown exactly as written, in the grid's header band.
export function playBoard(puzzle) {
  return {
    title: puzzle.title,
    created: dayLabel(puzzle.created),
    label: puzzle.type,
    solutionLabel: puzzle.type + ' · Solution',
    letters: puzzle.grid.map(function (row) { return row.split(''); }),
    rows: puzzle.grid.length,
    cols: puzzle.grid[0].length,
    words: puzzle.words.map(function (w) { return { text: w.word, cells: wordCells(w) }; })
  };
}

// ---- Tapping ----
// A play is { picked, found, events }: picked holds the selection's start, then its end
// (0–2 cells); found the indices of the words crossed off; events what this tap set off.

export function newPlay() {
  return { picked: [], found: [], events: [] };
}

export function solvedPlay(words) {
  return { picked: [], found: words.map(function (_, i) { return i; }), events: [] };
}

function sameCell(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function inLine(a, b) {
  var dr = b[0] - a[0], dc = b[1] - a[1];
  return dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
}

// Further along start→end, in the same direction, past end.
function beyond(start, end, cell) {
  var dr = Math.sign(end[0] - start[0]), dc = Math.sign(end[1] - start[1]);
  var kr = cell[0] - end[0], kc = cell[1] - end[1];
  var steps = Math.max(Math.abs(kr), Math.abs(kc));
  return kr === dr * steps && kc === dc * steps;
}

function spans(cells, picked) {
  var first = cells[0], last = cells[cells.length - 1];
  return (sameCell(first, picked[0]) && sameCell(last, picked[1])) ||
    (sameCell(first, picked[1]) && sameCell(last, picked[0]));
}

function keep(play, picked) {
  return { picked: picked, found: play.found, events: [] };
}

// Only a word's real placement counts — P then G inside PIGLET is not PIG.
function check(play, picked, words) {
  var hit = words.findIndex(function (w, i) { return !play.found.includes(i) && spans(w.cells, picked); });
  if (hit === -1) return keep(play, picked);
  var found = play.found.concat([hit]);
  return { picked: [], found: found, events: found.length === words.length ? ['complete'] : [] };
}

function tapFirst(play, cell) {
  return keep(play, [cell]);
}

function tapSecond(play, cell, words) {
  var start = play.picked[0];
  if (sameCell(cell, start)) return keep(play, []);
  if (!inLine(start, cell)) return keep(play, play.picked);
  return check(play, [start, cell], words);
}

function tapFurther(play, cell, words) {
  var start = play.picked[0], end = play.picked[1];
  if (sameCell(cell, end)) return keep(play, []);
  if (!beyond(start, end, cell)) return keep(play, play.picked);
  return check(play, [start, cell], words);
}

var PLAY_TAPS = [tapFirst, tapSecond, tapFurther];

export function tap(play, cell, words) {
  return PLAY_TAPS[play.picked.length](play, cell, words);
}

// ---- What the board shows ----

export function sharedCells(words) {
  var counts = {};
  words.forEach(function (w) {
    w.cells.forEach(function (c) {
      var k = JSON.stringify(c);
      counts[k] = (counts[k] || 0) + 1;
    });
  });
  return Object.keys(counts).filter(function (k) { return counts[k] > 1; }).map(function (k) { return JSON.parse(k); });
}

// found: a line through each found word; shared: a ring on each letter two found words
// share; wrong: the red line of an open selection; rings: a ring on its start letter.
export function playMarks(play, words) {
  var done = play.found.map(function (i) { return words[i]; });
  var start = play.picked.slice(0, 1);
  return {
    found: done.map(function (w) { return [w.cells[0], w.cells[w.cells.length - 1]]; }),
    shared: sharedCells(done),
    wrong: play.picked.slice(1).map(function (end) { return [start[0], end]; }),
    rings: start.map(function (cell) { return { cell: cell, kind: PLAY_RING_KINDS[play.picked.length] }; })
  };
}

export function wordList(play, words) {
  return words.map(function (w, i) { return { text: w.text, done: play.found.includes(i) }; });
}

export function countLabel(play, words) {
  return play.found.length + '/' + words.length;
}

// ---- Where the words sit ----
// Under the grid, beside it, or in an overlay toggled over it — the player's choice, cycled in
// that order and kept per device. Overlay is the first-visit default.

export function nextWordsLayout(layout) {
  return { bottom: 'right', right: 'overlay', overlay: 'bottom' }[layout];
}

// read() returns the stored choice; a page that can't read it, or reads anything else, gets Overlay.
export function savedWordsLayout(read) {
  try {
    return knownWordsLayout(read());
  } catch (e) {
    return 'overlay';
  }
}

function knownWordsLayout(saved) {
  return ['bottom', 'right', 'overlay'].includes(saved) ? saved : 'overlay';
}

// Whether the choice was stored; a page that can't store it keeps it until it closes.
export function saveWordsLayout(write, layout) {
  try {
    write(layout);
    return true;
  } catch (e) {
    return false;
  }
}

// Where each completion sparkle starts and drifts to, over a board width × height.
export function sparkles(count, width, height, random) {
  return Array.from({ length: count }, function () {
    var angle = random() * Math.PI * 2, distance = 30 + random() * 60;
    return {
      x: random() * width,
      y: random() * height,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      delay: random() * 0.35
    };
  });
}