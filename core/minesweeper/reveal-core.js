// A Reveal board's rules, after the product's docs/MOCKUP-MINES-REVEAL.html (its TASK-173 spec):
// every square covered but the start square's area, opening squares, marking mines, a number whose
// mines are all marked opening the rest round it, the kaboom, the finish, Check and Undo, and what
// each square shows. Pure — the DOM work is ui/minesweeper/play-ui.js. The page follows the file: a
// Reveal board's numbers hold every square that isn't a mine (tooling's docs/PUZZLE-FORMAT.md, mines
// 9), so a square opens to the number the file gives it, and the page never works out a move.
// Board reading, Check's mistakes and line, the Mines card's count and the frame are
// core/minesweeper/play-core.js's, shared with a Vanilla board.
import { keyOf, around } from './play-core.js';

// A play is { open, marks, boom, events }: open each opened square's key, true; marks each marked
// square's 'mine' by its key, as a Vanilla board's marks are, so the count, Check and a number's
// fill read them alike; boom the mine opened, '' until one is; events what this tap set off.

function cellOf(key) {
  return key.split(',').map(Number);
}

// The squares round one, its own among them: it is always open when this is asked, so it never
// opens again and is never marked.
function aroundKeys(key, board) {
  return around(cellOf(key), board).map(keyOf);
}

// Squares opening as classic minesweeper's do: each to its number, and a 0 opening all its
// neighbours, and on. A marked square never opens, and stops the spread there. keys is the
// caller's own fresh list, worked through in place.
function spread(open, keys, board, marks) {
  var next = Object.assign({}, open), waiting = keys;
  while (waiting.length) {
    var key = waiting.pop();
    if (next[key] || marks[key]) continue;
    next[key] = true;
    if (board.numbers[key] === 0) waiting.push.apply(waiting, aroundKeys(key, board));
  }
  return next;
}

// A board opens with every square covered but its start square — a 0 — and all it opens.
export function newRevealPlay(board) {
  return { open: spread({}, [board.start], board, {}), marks: {}, boom: '', events: [] };
}

// The board is finished once every square that isn't a mine is open.
export function revealFinished(play, board) {
  return Object.keys(play.open).length === board.rows * board.cols - board.mines.length;
}

// A kaboom or the finish ends the game: the board takes no more taps.
function revealOver(play, board) {
  return play.boom !== '' || revealFinished(play, board);
}

function still(play) {
  return { open: play.open, marks: play.marks, boom: play.boom, events: [] };
}

// Squares opened: a mine among them ends the game on it, with every square as it was; otherwise
// they open, and opening the last safe square marks every mine left unmarked and finishes it.
function opening(play, keys, board) {
  var mine = keys.filter(function (k) { return board.mines.includes(k); })[0];
  if (mine !== undefined) return { open: play.open, marks: play.marks, boom: mine, events: ['kaboom'] };
  var open = spread(play.open, keys, board, play.marks);
  var done = revealFinished({ open: open }, board);
  var marks = done ? Object.fromEntries(board.mines.map(function (k) { return [k, 'mine']; })) : play.marks;
  return { open: open, marks: marks, boom: '', events: done ? ['complete'] : [] };
}

// A covered square's mine mark, on or off.
function toggled(play, key) {
  var marks = Object.assign({}, play.marks);
  marks[key] = 'mine';
  if (play.marks[key]) delete marks[key];
  return { open: play.open, marks: marks, boom: '', events: [] };
}

// An opened number whose mines are all marked opens its other covered squares, as a Vanilla number
// fills its squares; a wrong mark carries in, so a mine among them goes off. With fewer or more
// marked, it does nothing.
function numberOpens(play, key, board) {
  var near = aroundKeys(key, board);
  var marked = near.filter(function (k) { return play.marks[k]; }).length;
  if (marked !== board.numbers[key]) return still(play);
  return opening(play, near.filter(function (k) { return !play.open[k] && !play.marks[k]; }), board);
}

// A tap, with Open or Mark mine picked under the board (tool 'open' or 'mark'): an opened number
// opens round it whichever is picked; a covered square opens with Open — a marked one never — and
// takes or loses its mark with Mark mine. A finished or exploded board takes no taps.
export function tapReveal(play, cell, board, tool) {
  var key = keyOf(cell);
  if (revealOver(play, board)) return still(play);
  if (play.open[key]) return numberOpens(play, key, board);
  if (tool === 'mark') return toggled(play, key);
  if (play.marks[key]) return still(play);
  return opening(play, [key], board);
}

// A right-click on a computer, or a long press on a phone, taps with the tool that isn't picked: it
// marks with Open picked and opens with Mark mine picked (the product's TASK-197).
export function otherTool(tool) {
  return { open: 'mark', mark: 'open' }[tool];
}

// ---- Undo ----
// Undo takes back mine marks only: opening a square is never undone. The history is the squares
// whose mark a tap changed, oldest first, held in the open page only. A square opened since can
// never be marked again, so its entries are dropped as they're reached.

export function revealTapped(history, before, after, cell) {
  var key = keyOf(cell);
  return history.concat([key].filter(function () { return before.marks[key] !== after.marks[key]; }));
}

function markable(history, play) {
  return history.filter(function (k) { return !play.open[k]; });
}

// The last mark change still on a covered square taken back, and the history before it.
export function undoneReveal(history, play) {
  var left = markable(history, play);
  if (!left.length) return { play: still(play), history: [] };
  return { play: toggled(play, left[left.length - 1]), history: left.slice(0, -1) };
}

// Undo greys out once only openings are left, and once the game is over.
export function canUndoReveal(history, play, board) {
  return !revealOver(play, board) && markable(history, play).length > 0;
}

// ---- What the board shows ----

// What a square is now: the mine that went off, opened, a mine shown by the kaboom, marked, or
// covered.
function squareIs(play, key, board) {
  if (key === play.boom) return 'boom';
  if (play.open[key]) return 'open';
  if (play.marks[key]) return 'marked';
  if (play.boom !== '' && board.mines.includes(key)) return 'shown';
  return 'covered';
}

// Every square, row by row: covered or open; its mark — 'blank' covered, 'mine', or 'number' once
// opened; the number it shows ('' covered, or for a 0), the same however many mines are marked round
// it, as a Vanilla number; its state — the kaboom's 'boom', a mine the kaboom shows 'shown', else '';
// 'wrong' on a mine mark the kaboom proves wrong; and what a screen reader hears of it.
export function revealSquares(play, board) {
  var looks = {
    covered: function () { return { cover: 'covered', mark: 'blank', number: '', state: '', said: 'covered' }; },
    marked: function () { return { cover: 'covered', mark: 'mine', number: '', state: '', said: 'marked mine' }; },
    open: function (key) {
      var n = String(board.numbers[key]);
      return { cover: 'open', mark: 'number', number: n === '0' ? '' : n, state: '', said: n };
    },
    boom: function () { return { cover: 'open', mark: 'mine', number: '', state: 'boom', said: 'mine, opened' }; },
    shown: function () { return { cover: 'open', mark: 'mine', number: '', state: 'shown', said: 'mine' }; }
  };
  return Array.from({ length: board.rows * board.cols }, function (_, i) {
    var cell = [Math.floor(i / board.cols), i % board.cols], key = keyOf(cell);
    var look = looks[squareIs(play, key, board)](key);
    var wrong = play.boom !== '' && Boolean(play.marks[key]) && !board.mines.includes(key);
    return {
      key: key, cover: look.cover, mark: look.mark, number: look.number, state: look.state,
      checked: wrong ? 'wrong' : '',
      label: 'Row ' + (cell[0] + 1) + ', column ' + (cell[1] + 1) + ', ' + look.said
    };
  });
}
