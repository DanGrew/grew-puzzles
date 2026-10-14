// The minesweeper play page's rules: which board a play URL names, what its board holds, what a
// tap does to the player's marks, how each number reads against them, when the board is solved,
// which marks Check rings and what Undo takes back, how the board sits in its frame, and whether it
// prints. Pure — the DOM work is ui/minesweeper/play-ui.js. The board
// file is grew-puzzles-tooling's docs/PUZZLE-FORMAT.md: the site only reads its numbers and its
// mines, and never works a board out. A number fades or turns red, and a tap on it fills its
// squares, from the player's own marks counted against it, never from the answer.
import { puzzleDifficulty } from '../kind-core.js';
import { centreOn } from '../maze/play-core.js';

// ---- Finding the board ----

// The play URL names a board by its hidden ID — minesweeper.html?id=MINE-0001 — and its file
// carries that name. Anything else names no board, so it never becomes a path.
export function minesUrl(search) {
  var id = new URLSearchParams(search).get('id');
  if (!/^MINE-[0-9]{4,}$/.test(id)) throw new Error('No such puzzle');
  return minesFile(id);
}

export function minesFile(hiddenId) {
  return '../content/puzzles/minesweeper/' + hiddenId + '.json';
}

// ---- The board ----

// A square is [row, col], from 0 at the top left; its key is 'row,col'.
export function keyOf(cell) {
  return cell[0] + ',' + cell[1];
}

// The squares round a number, edges and corners alike, on the board: the three rows and three
// columns about it. Its own square comes along, and never counts — a number is never marked, and
// never blank.
export function around(cell, board) {
  var rows = [cell[0] - 1, cell[0], cell[0] + 1], cols = [cell[1] - 1, cell[1], cell[1] + 1];
  return rows.flatMap(function (r) { return cols.map(function (c) { return [r, c]; }); }).filter(function (c) {
    return c[0] >= 0 && c[0] < board.rows && c[1] >= 0 && c[1] < board.cols;
  });
}

// A board that names a start square plays by the Reveal rule (core/minesweeper/reveal-core.js) —
// tooling's mines 8 holds a board to Reveal's rule exactly when it names one — and any other by
// marking. The page follows the file, never its type's name.
function ruleOf(puzzle) {
  return { true: 'reveal', false: 'vanilla' }['start' in puzzle];
}

function startOf(puzzle) {
  return [puzzle.start].filter(Boolean).map(function (s) { return keyOf([s.row, s.col]); }).concat([''])[0];
}

// What the page needs of a board file: its title, difficulty and code, its type's band, its size,
// its numbers by square and its mines — the answer, shown only on the card's back — and how it
// plays: its rule, and a Reveal board's start square by its key, '' on any other.
export function minesBoard(puzzle) {
  var numbers = {};
  puzzle.numbers.forEach(function (row, r) {
    row.split('').forEach(function (digit, c) {
      if (digit !== '.') numbers[r + ',' + c] = Number(digit);
    });
  });
  return {
    title: puzzle.title,
    difficulty: puzzleDifficulty(puzzle),
    code: puzzle.hiddenId,
    label: puzzle.type,
    solutionLabel: puzzle.type + ' · Solution',
    cols: puzzle.width,
    rows: puzzle.height,
    numbers: numbers,
    mines: puzzle.mines.map(function (m) { return m.row + ',' + m.col; }),
    rule: ruleOf(puzzle),
    start: startOf(puzzle)
  };
}

// ---- Marking ----
// A play is { marks, events }: marks each marked square's mark by its key — 'dot' for no mine,
// 'mine' for a mine; a square not in it is blank — and events what this tap set off.

export function newMinesPlay() {
  return { marks: {}, events: [] };
}

function markOf(play, cell) {
  return play.marks[keyOf(cell)] || 'blank';
}

function minesAround(play, cell, board) {
  return around(cell, board).filter(function (c) { return markOf(play, c) === 'mine'; }).length;
}

function blanksAround(play, cell, board) {
  return around(cell, board).filter(function (c) { return !(keyOf(c) in board.numbers) && markOf(play, c) === 'blank'; });
}

// The board is solved once the squares marked as mines are exactly its mines; dots don't count.
export function minesFinished(play, board) {
  var marked = Object.keys(play.marks).filter(function (k) { return play.marks[k] === 'mine'; });
  return marked.length === board.mines.length && board.mines.every(function (k) { return play.marks[k] === 'mine'; });
}

// A blank square cycles dot, mine, blank — players mark no-mine more than mine (the owner,
// 2026-10-11).
function nextMark(mark) {
  return { blank: 'dot', dot: 'mine', mine: 'blank' }[mark];
}

function marked(play, cells, mark) {
  var marks = Object.assign({}, play.marks);
  cells.forEach(function (c) { marks[keyOf(c)] = mark; });
  Object.keys(marks).forEach(function (k) { if (marks[k] === 'blank') delete marks[k]; });
  return marks;
}

// A tap on a number fills its blank squares once its count settles them: every mine marked round
// it, and they're dots; just as many mines missing as blank squares, and they're mines. Otherwise,
// and on a number already red, it does nothing. Only the number and the player's own marks count,
// so a wrong mark already there carries into the fill.
function numberFill(play, cell, board) {
  var missing = board.numbers[keyOf(cell)] - minesAround(play, cell, board);
  var blanks = blanksAround(play, cell, board);
  if (missing === 0) return marked(play, blanks, 'dot');
  if (missing === blanks.length) return marked(play, blanks, 'mine');
  return play.marks;
}

// A tap on a square: a blank one's mark moves on, a number fills round it. Once solved, the board
// takes no more taps. events is ['complete'] on the tap that solves it.
export function tapMines(play, cell, board) {
  if (minesFinished(play, board)) return { marks: play.marks, events: [] };
  var tap = { true: numberFill, false: function () { return marked(play, [cell], nextMark(markOf(play, cell))); } };
  var marks = tap[keyOf(cell) in board.numbers](play, cell, board);
  return { marks: marks, events: minesFinished({ marks: marks }, board) ? ['complete'] : [] };
}

// ---- Check and Undo ----
// Two plain buttons, no settings (the product's TASK-160 spec): Check points at the player's marks
// that disagree with the answer — the file's mines, the ones the flip shows — and never scores,
// penalises or blocks the finish; Undo takes back the taps of this visit, newest first, and has no
// Redo. The history is the plays before each tap that changed the marks, oldest first — held in
// the open page only, so a reload or another device starts it empty.

// The marked squares the answer disagrees with: a mine where there is none, a dot where there is
// one. A blank square is never checked.
export function minesMistakes(play, board) {
  return Object.keys(play.marks).filter(function (k) { return (play.marks[k] === 'mine') !== board.mines.includes(k); });
}

// The line under the board once Check is pressed.
export function checkLine(mistakes) {
  var n = mistakes.length;
  return { 0: 'No mistakes so far', 1: '1 mistake' }[n] || n + ' mistakes';
}

export function newMinesHistory() {
  return [];
}

function sameMarks(a, b) {
  var keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(function (k) { return a[k] === b[k]; });
}

// A tap from before to after joins the history if it changed the marks — a number's fill is one
// tap; a tap that changed nothing has nothing to take back.
export function tappedHistory(history, before, after) {
  return history.concat([{ marks: before.marks, events: [] }].filter(function () { return !sameMarks(before.marks, after.marks); }));
}

// Undo: the play before the last tap kept, and the history without it — with nothing kept, the
// play as it is. Nothing is set off.
export function undoneMines(history, play) {
  return { play: history.slice(-1).concat([play])[0], history: history.slice(0, -1) };
}

// Undo greys out once there's nothing left to take back, and on a solved board, which takes no more
// taps.
export function canUndo(history, play, board) {
  return history.length > 0 && !minesFinished(play, board);
}

// ---- What the board shows ----

// Every square, row by row: its cell, its key and its number — '' for a blank square.
export function minesSquares(board) {
  return Array.from({ length: board.rows * board.cols }, function (_, i) {
    var cell = [Math.floor(i / board.cols), i % board.cols];
    var key = keyOf(cell);
    return { cell: cell, key: key, number: key in board.numbers ? String(board.numbers[key]) : '' };
  });
}

// How a number reads against the player's marks: 'met' — faded — once as many mines are marked
// round it as it says, 'over' — red — once more are, else ''.
export function numberState(play, cell, board) {
  var n = board.numbers[keyOf(cell)], m = minesAround(play, cell, board);
  return m > n ? 'over' : m === n ? 'met' : '';
}

// What each square shows on the front: a number its state, a blank square its mark — and what a
// screen reader hears of it.
export function squareMarks(play, board) {
  var said = { blank: 'blank', dot: 'no mine', mine: 'mine' };
  return minesSquares(board).map(function (s) {
    var where = 'Row ' + (s.cell[0] + 1) + ', column ' + (s.cell[1] + 1) + ', ';
    if (s.number) return { key: s.key, mark: 'number', state: numberState(play, s.cell, board), label: where + s.number };
    return { key: s.key, mark: markOf(play, s.cell), state: '', label: where + said[markOf(play, s.cell)] };
  });
}

// The Mines card's count: mines marked, of the board's mines — 0/15.
export function minesCount(play, board) {
  var mines = Object.keys(play.marks).filter(function (k) { return play.marks[k] === 'mine'; }).length;
  return mines + '/' + board.mines.length;
}

// The answer, on the card's back: each square its number, a mine, or nothing.
export function answerSquares(board) {
  return minesSquares(board).map(function (s) {
    return { key: s.key, cell: s.cell, number: s.number, mine: board.mines.includes(s.key) };
  });
}

// ---- Paper ----

// A board prints on one 8.5×11 sheet, and goes into a book, only while its numbers stay readable
// there: at most 30 squares along its longer side (a call made for the owner, 2026-10-11, as for
// mazes). A bigger board plays on the site alone, with no Print and no page in a book.
export function minesPrints(cols, rows) {
  return Math.max(cols, rows) <= 30;
}

// Whether a board has a Print menu and a sheet: a Vanilla board up to 30 squares a side. A Reveal
// board never prints, whatever its size, as paper can't cover a square (the product's TASK-174).
export function boardPrints(board) {
  return board.rule === 'vanilla' && minesPrints(board.cols, board.rows);
}

// The sheet's one-line rule, under the title, with the board's own mine count. Paper is shaded
// with a pencil, so it says shade where the screen says find.
export function printedRule(board) {
  var mines = board.mines.length + { true: ' mine', false: ' mines' }[board.mines.length === 1];
  return 'Shade the ' + mines + '. Each number counts the mines in the eight squares around it. A numbered square is never a mine.';
}

// ---- The frame ----
// The grid card shows the board through its frame, as the maze page does (core/maze/play-core.js):
// a frame is { fit, width, height } — the square size that shows the whole board, and its width
// and height, px — and a view { cell, x, y } the square size zoomed to and the board's point at the
// frame's top-left, in squares. A board whose whole fits at a comfortable tap size plays whole and
// never zooms; any other opens zoomed in, and zooms from the whole board to 48px squares.

// The squares are never bigger than the mockup's 44px, and a whole pixel while the board can be
// tapped whole. m: the screen's viewHeight, the room the card's band and edges take above and round
// the board (chromeHeight, chromeWidth), the page's width, and the board's rows and cols.
export function minesFrame(m) {
  var room = Math.min((m.viewHeight - m.chromeHeight) / m.rows, (m.width - m.chromeWidth) / m.cols);
  var fit = Math.min(44, Math.max(Math.floor(room), Math.min(room, 10)));
  return { fit: fit, width: m.cols * fit, height: m.rows * fit };
}

// 24px is the least a square is comfortably tapped at.
function tappable(frame) {
  return frame.fit >= 24;
}

function mostCell(frame) {
  return tappable(frame) ? frame.fit : Math.max(frame.fit, 48);
}

function zoomedTo(cell, frame) {
  return Math.min(Math.max(cell, frame.fit), mostCell(frame));
}

function middleOf(view, frame) {
  return [view.y + frame.height / view.cell / 2 - 0.5, view.x + frame.width / view.cell / 2 - 0.5];
}

// Where a board opens zoomed in: a Reveal board on its start square, where its opened squares are,
// any other on its middle.
function openingCentre(board) {
  return [board.start].filter(Boolean).map(function (k) { return k.split(',').map(Number); })
    .concat([[(board.rows - 1) / 2, (board.cols - 1) / 2]])[0];
}

// A board opens whole, unless that leaves its squares too small to tap: then zoomed in, squares
// 36px across.
export function minesOpenView(frame, board) {
  var cell = tappable(frame) ? frame.fit : 36;
  return centreOn({ cell: cell, x: 0, y: 0 }, openingCentre(board), frame, board);
}

// The screen resized, from the frame before to this one: a player looking at the whole board still
// is; any other zoom stays as it was, as far as this frame's zoom runs, about the same middle.
export function minesRefit(view, before, frame, board) {
  var cell = view.cell === before.fit ? frame.fit : zoomedTo(view.cell, frame);
  return centreOn({ cell: cell, x: 0, y: 0 }, middleOf(view, before), frame, board);
}

// Zoomed by a factor about the middle of what's on view, which stays where it is.
export function minesZoom(view, factor, frame, board) {
  return centreOn({ cell: zoomedTo(view.cell * factor, frame), x: 0, y: 0 }, middleOf(view, frame), frame, board);
}

// What the zoom can do: zoom in, zoom out, and whether this board zooms at all.
export function minesZoomState(view, frame) {
  return { zoomIn: view.cell < mostCell(frame), zoomOut: view.cell > frame.fit, zoomable: !tappable(frame) };
}

// The board dragged by a finger from one point to another, px: it goes with the finger.
export function minesDrag(view, from, to, frame, board) {
  return centreOn(view, [
    view.y + frame.height / view.cell / 2 - 0.5 - (to.y - from.y) / view.cell,
    view.x + frame.width / view.cell / 2 - 0.5 - (to.x - from.x) / view.cell
  ], frame, board);
}

// A finger that moves further than this from where it went down is moving the board, and its
// lift taps nothing — so panning never marks a square by accident.
export function movedFar(from, to) {
  return Math.hypot(to.x - from.x, to.y - from.y) > 8;
}

// What a press moving on the board does: one finger, or the mouse, drags it; two or more pinch.
export function pressKind(fingers) {
  return fingers > 1 ? 'pinch' : 'drag';
}
