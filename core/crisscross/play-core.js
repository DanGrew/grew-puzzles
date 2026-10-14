// The criss-cross play page's rules: which shape a play URL names, what its shape holds, what a tap
// on a square or a word does, what each square and word shows, when the shape is full and when it
// is right, and how the shape sits in its frame and on the little map. Pure — the DOM work is
// ui/crisscross/play-ui.js. The shape file is grew-puzzles-tooling's docs/PUZZLE-FORMAT.md: the
// site reads the shape, the list, the starting word and each word's place, and never works one out.
// A word is refused only by letters already on screen, which tells the player nothing, and a wrong
// word is never pointed out — only, once the shape is full, that some word is.
import { puzzleDifficulty } from '../kind-core.js';
import { minesOpenView, minesRefit, minesZoomState } from '../minesweeper/play-core.js';

// ---- Finding the shape ----

// The play URL names a shape by its hidden ID — crisscross.html?id=CRSS-0001 — and its file
// carries that name. Anything else names no shape, so it never becomes a path.
export function crissUrl(search) {
  var id = new URLSearchParams(search).get('id');
  if (!/^CRSS-[0-9]{4,}$/.test(id)) throw new Error('No such puzzle');
  return crissFile(id);
}

export function crissFile(hiddenId) {
  return '../content/puzzles/crisscross/' + hiddenId + '.json';
}

// ---- The shape ----

// A square is [row, col], from 0 at the top left; its key is 'row,col'.
function keyOf(cell) {
  return cell[0] + ',' + cell[1];
}

// A word as its squares hold it: accents off, uppercase — Café is CAFE.
export function wordLetters(word) {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

// A word's squares from its place: across (E) or down (S) from its start.
function placeCells(w) {
  var step = { E: [0, 1], S: [1, 0] }[w.direction];
  return Array.from({ length: w.length }, function (_, k) { return [w.start.row + step[0] * k, w.start.col + step[1] * k]; });
}

// What the page needs of a shape file: its title, difficulty and code, its type's band, its size,
// its squares in use, its words as listed, and a slot for each word's place — slot i is word i's,
// numbered as a crossword's starts are, row by row. The list's order is the file's: shortest first,
// then A to Z. The starting word is filled in for the player.
export function crissBoard(puzzle) {
  var slots = puzzle.words.map(function (w) {
    return { cells: placeCells(w), length: w.length, across: w.direction === 'E', answer: wordLetters(w.word) };
  });
  var squares = [];
  puzzle.squares.forEach(function (row, r) {
    row.split('').forEach(function (mark, c) { if (mark === '#') squares.push([r, c]); });
  });
  var firsts = slots.map(function (s) { return keyOf(s.cells[0]); });
  var starts = squares.map(keyOf).filter(function (k) { return firsts.includes(k); });
  return {
    title: puzzle.title,
    difficulty: puzzleDifficulty(puzzle),
    code: puzzle.hiddenId,
    label: puzzle.type,
    solutionLabel: puzzle.type + ' · Solution',
    cols: puzzle.width,
    rows: puzzle.height,
    squares: squares,
    words: puzzle.words.map(function (w) { return { word: w.word, letters: wordLetters(w.word) }; }),
    slots: slots.map(function (s) { return Object.assign(s, { number: starts.indexOf(keyOf(s.cells[0])) + 1 }); }),
    given: puzzle.words.findIndex(function (w) { return w.word === puzzle.given; })
  };
}

// The slots through a square, across first.
function slotsAt(board, cell) {
  var key = keyOf(cell);
  return board.slots.map(function (s, i) { return i; })
    .filter(function (i) { return board.slots[i].cells.some(function (c) { return keyOf(c) === key; }); })
    .sort(function (a, b) { return Number(board.slots[b].across) - Number(board.slots[a].across); });
}

// ---- Playing ----
// A play is { placed, picked, events, clashes, note }: placed the word in each filled slot, by slot;
// picked the slot picked, or -1; events what this tap set off — 'placed', 'clash' or 'complete';
// clashes the squares whose letters refused a word; note a word to the player about this tap, if any.

export function newCrissPlay(board) {
  var placed = {};
  placed[board.given] = board.given;
  return { placed: placed, picked: -1, events: [], clashes: [], note: '' };
}

function after(play, changes) {
  return Object.assign({ placed: play.placed, picked: play.picked, events: [], clashes: [], note: '' }, changes);
}

// The slot a word is in, or undefined.
function slotHolding(play, word) {
  return Object.keys(play.placed).map(Number).find(function (s) { return play.placed[s] === word; });
}

// The letter a square shows: the one any filled slot through it gives it, but the slot left out, if any.
function letterAt(play, board, cell, leaveOut) {
  var filled = slotsAt(board, cell).filter(function (s) { return s !== leaveOut && s in play.placed; });
  return filled.map(function (s) {
    var at = board.slots[s].cells.findIndex(function (c) { return keyOf(c) === keyOf(cell); });
    return board.words[play.placed[s]].letters[at];
  })[0] || '';
}

// Every slot holds a word.
export function crissFull(play, board) {
  return Object.keys(play.placed).length === board.slots.length;
}

// Every slot holds its own word — or one spelt the same, which reads the same.
export function crissFinished(play, board) {
  return crissFull(play, board) && board.slots.every(function (s, i) { return board.words[play.placed[i]].letters === s.answer; });
}

// A tap on a square picks a slot through it, across first. Tapped again, where two slots cross, it
// picks the other; where only one runs, it lets go. The starting word's slot is never picked. Once
// solved, the shape takes no more taps.
export function tapSquare(play, cell, board) {
  var here = slotsAt(board, cell).filter(function (s) { return s !== board.given; });
  var picked = here.includes(play.picked)
    ? (here.find(function (s) { return s !== play.picked; }) ?? -1)
    : (here[0] ?? -1);
  return after(play, { picked: crissFinished(play, board) ? play.picked : picked });
}

// A tap on a word: a word already in a slot comes out — its letters another word shares staying —
// unless another slot is picked, where it moves; any other goes into the slot picked, if it's that
// long and every letter already in the slot agrees, and the slot lets go. A word refused names why.
// The starting word stays where it is, and once solved, the shape takes no more taps.
export function tapWord(play, word, board) {
  if (crissFinished(play, board) || word === board.given) return after(play, {});
  var held = slotHolding(play, word);
  if (held !== undefined && [-1, held].includes(play.picked)) return after(play, { placed: without(play.placed, held) });
  if (play.picked < 0) return after(play, { note: 'Pick a slot first, then the word.' });
  return placeIn(play, word, held, board);
}

function without(placed, slot) {
  var left = Object.assign({}, placed);
  delete left[slot];
  return left;
}

function placeIn(play, word, held, board) {
  var slot = board.slots[play.picked], letters = board.words[word].letters;
  if (letters.length !== slot.length) return after(play, { note: 'That slot needs a ' + slot.length + '-letter word.' });
  var clashes = slot.cells.filter(function (c, k) {
    var there = letterAt(play, board, c, play.picked);
    return there !== '' && there !== letters[k];
  });
  if (clashes.length) {
    return after(play, { events: ['clash'], clashes: clashes, note: board.words[word].word + " doesn't fit the letters already there." });
  }
  var placed = without(play.placed, held);
  placed[play.picked] = word;
  var next = after(play, { placed: placed, picked: -1 });
  next.events = ['placed'].concat(crissFinished(next, board) ? ['complete'] : []);
  return next;
}

// ---- What the shape shows ----

// Every square in use, row by row: its cell, its key, and the number its slot starts with, if any.
export function crissSquares(board) {
  var numbers = new Map(board.slots.map(function (s) { return [keyOf(s.cells[0]), String(s.number)]; }));
  return board.squares.map(function (cell) {
    return { cell: cell, key: keyOf(cell), number: numbers.get(keyOf(cell)) || '' };
  });
}

// What each square shows: its letter, whether it's in the slot picked, whether the starting word
// gave it, and what a screen reader hears of it.
export function squareMarks(play, board) {
  return board.squares.map(function (cell) {
    var letter = letterAt(play, board, cell), through = slotsAt(board, cell);
    return {
      key: keyOf(cell), letter: letter, picked: through.includes(play.picked), given: through.includes(board.given),
      label: 'Row ' + (cell[0] + 1) + ', column ' + (cell[1] + 1) + ', ' + (letter || 'empty')
    };
  });
}

// The squares of the slot just filled, to drop its letters in.
export function placedSquares(play, board, before) {
  var slot = Object.keys(play.placed).find(function (s) { return before.placed[s] !== play.placed[s]; });
  return slot === undefined ? [] : board.slots[slot].cells.map(keyOf);
}

// The Words card's count: words in the shape, the starting word among them, of all of them — 1/20.
export function crissCount(play, board) {
  return Object.keys(play.placed).length + '/' + board.slots.length;
}

// The Words card's groups, shortest first, each word in the list's order: a group dims while a slot
// of another length is picked; a word in the shape is crossed off, the starting word for good. A
// word shows under the shape too, on a phone, while a slot its length is picked.
export function wordGroups(play, board) {
  var slot = board.slots[play.picked];
  var lengths = Array.from(new Set(board.words.map(function (w) { return w.letters.length; }))).sort(function (a, b) { return a - b; });
  var used = Object.keys(play.placed).map(function (s) { return play.placed[s]; });
  return lengths.map(function (n) {
    return {
      length: n, heading: n + ' letters', dim: slot !== undefined && n !== slot.length,
      words: board.words.map(function (w, i) { return i; }).filter(function (i) { return board.words[i].letters.length === n; }).map(function (i) {
        var given = i === board.given, inShape = used.includes(i);
        return {
          index: i, word: board.words[i].word, used: inShape, given: given, picked: n === slot?.length,
          title: given ? 'Given to start you off' : inShape ? 'Tap to take it out' : ''
        };
      })
    };
  });
}

// The line over the words: a note about the last tap, else the slot picked — 3 across, 5 letters,
// and the word it holds — else what to do. In three parts, the middle one strong.
export function pickingLine(play, board) {
  var slot = board.slots[play.picked];
  if (play.note) return [play.note, '', ''];
  if (!slot) return ['Tap a square to pick a slot.', '', ''];
  var holds = play.picked in play.placed ? ' · holds ' + board.words[play.placed[play.picked]].word : '';
  return ['Picked: ', slot.number + ' ' + (slot.across ? 'across' : 'down'), ', ' + slot.length + ' letters' + holds];
}

// Under the shape: once every slot is filled, solved or not — never which word is wrong.
export function crissStatus(play, board) {
  if (crissFinished(play, board)) return { state: 'solved', text: 'Solved — every word in place' };
  if (crissFull(play, board)) return { state: 'wrong', text: 'Every word is in, but some are in the wrong place.' };
  return { state: '', text: '' };
}

// The answer, on the card's back: each square its letter, read off the words' places.
export function answerSquares(board) {
  var letters = new Map();
  board.slots.forEach(function (s) { s.cells.forEach(function (c, k) { letters.set(keyOf(c), s.answer[k]); }); });
  return crissSquares(board).map(function (s) { return Object.assign(s, { letter: letters.get(s.key) }); });
}

// ---- Paper ----

// The sheet's one-line rule, under the title.
export var CRISS_PRINTED_RULE = 'Fit every word into the shape. Words cross where they share a letter.';

// The most lines the sheet's Words card has room for under the tallest shape that prints: its four
// columns of ten lines, less a line each for a group's heading pushed to the next column's top.
var CRISS_PRINT_LINES = 36;

// The lines the sheet's list takes: a heading a length, then a word a line.
function printedLines(board) {
  return board.words.length + new Set(board.words.map(function (w) { return w.letters.length; })).size;
}

// A shape prints on one 8.5×11 sheet, and goes into a book, only while its squares stay big enough
// to write in — at most 25 along its longer side (a call made for the owner, 2026-10-11) — and its
// list fits under it on the same page. Its letters never shrink to fit: any other shape plays on
// the site alone, with no Print and no page in a book.
export function crissPrints(board) {
  return Math.max(board.cols, board.rows) <= 25 && printedLines(board) <= CRISS_PRINT_LINES;
}

// ---- The frame ----
// The grid card shows the shape through its frame, as the minesweeper page does
// (core/minesweeper/play-core.js), whose view, zoom and drag the page takes as they are: a shape
// whose squares fit at 24px or more plays whole; any other opens zoomed in on its middle at 36px.

// The shape fits the screen's height times the player's size (size-core's sizeScale: 1 at Small,
// the page as it was before the choice came to it), so from Normal up a tall shape runs past the
// screen and the page scrolls; and the page's width, whatever the size, so a phone's shape stops at
// the screen's width. Its squares are never bigger than the mockup's 36px times the size, to the
// whole pixel — 61px at Huge — and a whole pixel while the shape can be tapped whole. m: the
// screen's viewHeight, the room the card's band and edges take above and round the shape
// (chromeHeight, chromeWidth), the page's width, the size's scale, and the shape's rows and cols.
export function crissFrame(m) {
  var room = Math.min((m.viewHeight - m.chromeHeight) * m.scale / m.rows, (m.width - m.chromeWidth) / m.cols);
  var fit = Math.min(Math.round(36 * m.scale), Math.max(Math.floor(room), Math.min(room, 10)));
  return { fit: fit, width: m.cols * fit, height: m.rows * fit };
}

// The frame sized again — the screen resized, or a size picked — from the frame before to this one.
// A shape that zoomed keeps the player's zoom, as the minesweeper page's does; one that showed whole
// only because it could be tapped whole opens as a first visit at this size would, zoomed in on its
// middle once it no longer can.
export function crissRefit(view, before, frame, board) {
  return minesZoomState(view, before).zoomable ? minesRefit(view, before, frame, board) : minesOpenView(frame, board);
}

// ---- The little map ----
// While zoomed in, the little map shows the whole shape — the maze's (core/maze/play-core.js), its
// size, box and drag taken as they are: each square in use, the filled ones darker, the slot picked
// in the band's green. Never the answer.

export function minimapSquares(play, board) {
  return squareMarks(play, board).map(function (m, i) {
    return { x: board.squares[i][1], y: board.squares[i][0], ink: m.picked ? 'picked' : m.letter ? 'filled' : 'empty' };
  });
}
