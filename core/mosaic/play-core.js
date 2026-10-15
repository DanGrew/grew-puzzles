// The mosaic play page's rules: which board a play URL names, what its board holds, what a tap
// does to the player's squares, when the board is solved, which squares Check rings and what Undo
// takes back, and what the board on view draws — the page draws only what's on screen, so a
// 200×200 plays (the product's TASK-164 spec). Pure — the DOM work is ui/mosaic/play-ui.js. The
// board file is grew-puzzles-tooling's docs/PUZZLE-FORMAT.md: the site only reads its numbers, its
// answer and its name, and never works a board out. A number never changes how it looks, as
// spotting one that's met is the player's, and finding a mistake is Check's (the owner, 2026-10-14).
import { puzzleDifficulty } from '../kind-core.js';
import { around, keyOf, minesPrints } from '../minesweeper/play-core.js';

// ---- Finding the board ----

// The play URL names a board by its hidden ID — mosaic.html?id=MOSA-0001 — and its file carries
// that name. Anything else names no board, so it never becomes a path.
export function mosaicUrl(search) {
  var id = new URLSearchParams(search).get('id');
  if (!/^MOSA-[0-9]{4,}$/.test(id)) throw new Error('No such puzzle');
  return mosaicFile(id);
}

export function mosaicFile(hiddenId) {
  return '../content/puzzles/mosaic/' + hiddenId + '.json';
}

// ---- The board ----

// The squares a text grid marks, by key: each one whose character passes keep, valued by value.
function gridSquares(rows, keep, value) {
  var squares = {};
  rows.forEach(function (row, r) {
    row.split('').forEach(function (ch, c) {
      if (keep(ch)) squares[r + ',' + c] = value(ch);
    });
  });
  return squares;
}

// What the page needs of a board file: its title, difficulty and code, its type's band, its size,
// its numbers by square, its shaded squares — the answer, shown only on the card's back and once
// it's solved — and its picture's name, shown only once it's solved. start is '' — a board opens
// on its middle (core/minesweeper/play-core.js minesOpenView).
export function mosaicBoard(puzzle) {
  return {
    title: puzzle.title,
    difficulty: puzzleDifficulty(puzzle),
    code: puzzle.hiddenId,
    label: puzzle.type,
    solutionLabel: puzzle.type + ' · Solution',
    name: puzzle.name,
    cols: puzzle.width,
    rows: puzzle.height,
    numbers: gridSquares(puzzle.numbers, function (ch) { return ch !== '.'; }, Number),
    shaded: gridSquares(puzzle.answer, function (ch) { return ch === '#'; }, function () { return true; }),
    start: ''
  };
}

// ---- Marking ----
// A play is { marks, events }: marks each marked square's mark by its key — 'blank' for left
// blank, 'shade' for shaded; a square not in it is clear — and events what this tap set off.

export function newMosaicPlay() {
  return { marks: {}, events: [] };
}

function markOf(play, cell) {
  return play.marks[keyOf(cell)] || 'clear';
}

// The board is solved once the shaded squares are exactly its answer; blanks don't count.
export function mosaicFinished(play, board) {
  var shaded = Object.keys(play.marks).filter(function (k) { return play.marks[k] === 'shade'; });
  return shaded.length === Object.keys(board.shaded).length && shaded.every(function (k) { return board.shaded[k]; });
}

// Every square, a number's too, cycles blank, shade, clear — most squares a player settles are blank
// (the owner, 2026-10-14), and marking single squares is the focus (the owner, 2026-10-15). A blank
// square shows as a pale tint, not a dot, which could hide a number (the owner, 2026-10-15).
function nextMark(mark) {
  return { clear: 'blank', blank: 'shade', shade: 'clear' }[mark];
}

function marked(play, cells, mark) {
  var marks = Object.assign({}, play.marks);
  cells.forEach(function (c) { marks[keyOf(c)] = mark; });
  Object.keys(marks).forEach(function (k) { if (marks[k] === 'clear') delete marks[k]; });
  return marks;
}

function cycled(play, cell) {
  return marked(play, [cell], nextMark(markOf(play, cell)));
}

// A number's fill — the shortcut, by a right-click, or a tap with Fill picked on a phone: once its block, itself
// included, holds its count of shaded squares, its clear squares are left blank; once its clear squares
// are exactly what it still needs, they're shaded. Otherwise, and on a block with one too many, it
// does nothing. Only the player's own squares count, so a wrong one already there carries in.
function numberFill(play, cell, board) {
  var block = around(cell, board);
  var missing = board.numbers[keyOf(cell)] - block.filter(function (c) { return markOf(play, c) === 'shade'; }).length;
  var clear = block.filter(function (c) { return markOf(play, c) === 'clear'; });
  if (missing === 0) return marked(play, clear, 'blank');
  if (missing === clear.length) return marked(play, clear, 'shade');
  return play.marks;
}

// A tap on a square, with the tool picked — 'cycle' or 'fill': Fill on a number fills its block,
// anything else cycles the square. Once solved, the board takes no more taps. events is
// ['complete'] on the tap that solves it.
export function tapMosaic(play, cell, board, tool) {
  if (mosaicFinished(play, board)) return { marks: play.marks, events: [] };
  var fills = tool === 'fill' && keyOf(cell) in board.numbers;
  var marks = fills ? numberFill(play, cell, board) : cycled(play, cell);
  return { marks: marks, events: mosaicFinished({ marks: marks }, board) ? ['complete'] : [] };
}

// The tool a right-click uses: always Fill — the shortcut, whichever is picked.
export function rightTool() {
  return 'fill';
}

// ---- Check and Undo ----
// As minesweeper's (the product's TASK-160): Check points at the player's squares that disagree
// with the answer and never scores or blocks the finish; Undo takes back this visit's taps, a
// fill as one, newest first (core/minesweeper/play-core.js tappedHistory, undoneMines).

// The marked squares the answer disagrees with: a square shaded that isn't, a blank on one that is.
// A clear square is never checked.
export function mosaicMistakes(play, board) {
  return Object.keys(play.marks).filter(function (k) { return (play.marks[k] === 'shade') !== Boolean(board.shaded[k]); });
}

// Undo greys out once there's nothing left to take back, and on a solved board.
export function canUndoMosaic(history, play, board) {
  return history.length > 0 && !mosaicFinished(play, board);
}

// ---- What the page says ----

// The Squares card's count: how many squares are shaded — 0 shaded.
export function mosaicCount(play) {
  return Object.keys(play.marks).filter(function (k) { return play.marks[k] === 'shade'; }).length + ' shaded';
}

// The title: Mosaic 007 until it's solved, then its picture's name, Barn Owl — the name shows
// nowhere before.
export function mosaicTitle(play, board) {
  return mosaicFinished(play, board) ? board.name : board.title;
}

// The finish's line.
export function completeLine(board) {
  return 'Solved — it\'s ' + board.name + '.';
}

// What a screen reader hears of a square: where it is, its number, and its mark.
export function squareSaid(play, board, cell) {
  var said = { clear: 'clear', blank: 'left blank', shade: 'shaded' };
  var key = keyOf(cell);
  var number = key in board.numbers ? 'number ' + board.numbers[key] + ', ' : '';
  return 'Row ' + (cell[0] + 1) + ', column ' + (cell[1] + 1) + ', ' + number + said[markOf(play, cell)];
}

// The answer as a play: every square of the picture shaded — what the card's back draws.
export function answerPlay(board) {
  return { marks: Object.fromEntries(Object.keys(board.shaded).map(function (k) { return [k, 'shade']; })), events: [] };
}

// ---- Paper ----

// A board prints on one 8.5×11 sheet, and goes into a book, only while its numbers stay readable
// there: at most 30 squares along both sides, as a minesweeper board (the owner, 2026-10-13; the
// product's TASK-168) — a 30×38 stays on the site. A bigger board plays on the site alone, with no
// Print and no page in a book.
export function mosaicPrints(board) {
  return minesPrints(board.cols, board.rows);
}

// The squares on paper, row by row: each its number or '' for the pencil, and whether a heavier
// line follows it on its right or below — after every fifth column and row but the board's last,
// which its border draws, so a big board is easy to count across (the product's
// docs/MOCKUP-MOSAIC.html). Never a shaded square, so nothing of the answer or the player's squares
// reaches the paper.
export function paperSquares(board) {
  var guide = function (i, size) { return (i + 1) % 5 === 0 && i < size - 1; };
  var squares = [];
  for (var r = 0; r < board.rows; r++) {
    for (var c = 0; c < board.cols; c++) {
      var key = r + ',' + c;
      squares.push({ number: key in board.numbers ? String(board.numbers[key]) : '', right: guide(c, board.cols), below: guide(r, board.rows) });
    }
  }
  return squares;
}

// ---- Pointing at a square ----
// A view is minesweeper's { cell, x, y }: the square size zoomed to, and the board's point at the
// frame's top-left, in squares (core/minesweeper/play-core.js).

// The square under a point on the frame, px from its top-left.
export function cellAt(view, point) {
  return [Math.floor(view.y + point.y / view.cell), Math.floor(view.x + point.x / view.cell)];
}

export function onBoard(cell, board) {
  return cell[0] >= 0 && cell[0] < board.rows && cell[1] >= 0 && cell[1] < board.cols;
}

// The keys: an arrow moves the square in focus, kept on the board; Enter or Space taps it with the
// tool picked, F fills it. Any other key does nothing here.
export function keyAction(key) {
  var moves = { ArrowUp: 'move', ArrowDown: 'move', ArrowLeft: 'move', ArrowRight: 'move', Enter: 'tap', ' ': 'tap', f: 'fill', F: 'fill' };
  return moves[key] || 'none';
}

export function keyMove(cell, key, board) {
  var step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key] || [0, 0];
  return [Math.min(Math.max(cell[0] + step[0], 0), board.rows - 1), Math.min(Math.max(cell[1] + step[1], 0), board.cols - 1)];
}

// Whether a square is wholly on view.
export function cellShows(view, frame, cell) {
  return cell[0] >= view.y && cell[0] + 1 <= view.y + frame.height / view.cell &&
    cell[1] >= view.x && cell[1] + 1 <= view.x + frame.width / view.cell;
}

// ---- What the board on view draws ----
// Only the squares on view are drawn, however big the board, each layer as a list the page draws
// without deciding anything: the shaded squares; a numbered square's tint while it's clear;
// the blank squares, a numbered one's too; the numbers, light on a shaded square;
// Check's rings; and the grid lines between squares. A square too small to read draws no number, and
// too small to see a line between, no lines. Every place is px from the frame's top-left.

// The squares on view: whole rows and columns, from the one the frame's edge cuts.
export function viewSpan(view, frame, board) {
  return {
    top: Math.max(0, Math.floor(view.y)),
    left: Math.max(0, Math.floor(view.x)),
    bottom: Math.min(board.rows - 1, Math.ceil(view.y + frame.height / view.cell) - 1),
    right: Math.min(board.cols - 1, Math.ceil(view.x + frame.width / view.cell) - 1)
  };
}

// Numbers show from 10px squares, lines from 6px.
var SMALLEST_NUMBER = 10;
var SMALLEST_LINE = 6;

// Each edge of a span of squares — columns from view.x, or rows from view.y — px, snapped to the
// screen's own pixels (ratio of them to a px), so squares side by side meet with no seam: each
// square's start and its size.
function edges(from, to, at, cell, ratio) {
  var snap = function (i) { return Math.round((i - at) * cell * ratio) / ratio; };
  var out = {};
  for (var i = from; i <= to; i++) out[i] = { at: snap(i), size: snap(i + 1) - snap(i) };
  return out;
}

// checked: the keys Check rings, [] when it isn't showing; ratio the screen's pixels to a px. One
// pass over the squares on view, as the whole of a big board is tens of thousands of them. Each
// square is { x, y, w, h }.
export function boardDrawing(play, board, view, frame, checked, ratio) {
  var cell = view.cell;
  var span = viewSpan(view, frame, board);
  var cols = edges(span.left, span.right, view.x, cell, ratio), rows = edges(span.top, span.bottom, view.y, cell, ratio);
  var rings = new Set(checked);
  var readable = cell >= SMALLEST_NUMBER;
  var out = { size: cell, shaded: [], tints: [], blanks: [], numbers: [], rings: [], lines: cell >= SMALLEST_LINE ? gridLines(span, view, frame) : [] };
  for (var r = span.top; r <= span.bottom; r++) {
    for (var c = span.left; c <= span.right; c++) {
      var key = r + ',' + c;
      var mark = play.marks[key];
      var numbered = key in board.numbers;
      var p = { x: cols[c].at, y: rows[r].at, w: cols[c].size, h: rows[r].size };
      if (mark === 'shade') out.shaded.push(p);
      if (numbered && !mark) out.tints.push(p);
      if (mark === 'blank') out.blanks.push(p);
      if (numbered && readable) out.numbers.push({ x: p.x + cell / 2, y: p.y + cell / 2, text: String(board.numbers[key]), light: mark === 'shade' });
      if (rings.has(key)) out.rings.push(p);
    }
  }
  return out;
}

// The lines between squares on view, each { x1, y1, x2, y2 }: one after every column and every row
// but the board's last, which its border draws.
function gridLines(span, view, frame) {
  var cols = [], rows = [];
  for (var c = span.left + 1; c <= span.right; c++) cols.push((c - view.x) * view.cell);
  for (var r = span.top + 1; r <= span.bottom; r++) rows.push((r - view.y) * view.cell);
  return cols.map(function (x) { return { x1: x, y1: 0, x2: x, y2: frame.height }; })
    .concat(rows.map(function (y) { return { x1: 0, y1: y, x2: frame.width, y2: y }; }));
}

// Where the square in focus is drawn, px from the frame's top-left, and its size: the keys' ring.
export function squareAt(view, cell) {
  return { x: (cell[1] - view.x) * view.cell, y: (cell[0] - view.y) * view.cell, size: view.cell };
}

// The finish melts the numbers and lines away over length ms: how far through it is at now, from 0
// to 1 — 1 once it's over, and at once with no length, for a player who asks for less motion.
export function meltAt(start, now, length) {
  return length > 0 ? Math.min(1, Math.max(0, (now - start) / length)) : 1;
}

// How long the melt takes, ms: none for a player who asks for less motion.
export function meltLength(reduced) {
  return reduced ? 0 : 900;
}

// How much of the numbers, blanks, tints and lines still show, from how far the melt has gone.
export function showing(melt) {
  return 1 - melt;
}

// Check's ring's width on a square, px.
export function ringWidth(cell) {
  return Math.max(3, cell * 0.11);
}

// A number's type size on a square, px.
export function numberSize(cell) {
  return cell * 0.5;
}
