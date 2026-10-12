// Saved criss-cross progress: what a placed word saves, and how a saved shape comes back. A shape is
// one row, saved over each time a word goes in or comes out — the whole set of words in place, each
// a slot named by its first square and its way, and the word in it, never one row per word — and
// whether it is finished. The starting word is never saved: the page puts it in every time. The
// table, and that a player reaches only their own row, are grew-puzzles-tooling's docs/DATABASE.md.
// Only the newest words are ever sent, one save at a time, so the last word always wins: the
// one-slot wait is core/maze/progress-core.js's, as a minesweeper board's is. Pure — the saving
// itself is ui/crisscross/progress-ui.js.
import { crissFinished, newCrissPlay } from './play-core.js';

// A slot's way as the table writes it: E across, S down.
function wayOf(slot) {
  return { true: 'E', false: 'S' }[slot.across];
}

// The words in place but the starting one, by slot — a slot's number keys come in order — as the
// table holds them.
function placedWords(play, board) {
  return Object.keys(play.placed).map(Number).filter(function (s) { return s !== board.given; })
    .map(function (s) {
      var slot = board.slots[s];
      return { row: slot.cells[0][0], col: slot.cells[0][1], direction: wayOf(slot), word: board.words[play.placed[s]].word };
    });
}

// The shape's row: its hidden ID, its words and whether it's finished. The database fills in who
// and when.
export function wordsRow(puzzle, play, board) {
  return { puzzle: puzzle, words: placedWords(play, board), finished: crissFinished(play, board) };
}

// What a tap saves: the shape's row, if the tap put a word in, took one out or moved one — picking a
// slot, a refused word, or a tap on a solved shape, saves nothing.
export function tapRows(puzzle, before, after, board) {
  var row = wordsRow(puzzle, after, board);
  return [row].filter(function () { return JSON.stringify(wordsRow(puzzle, before, board)) !== JSON.stringify(row); });
}

// The slot a saved word names, by its first square and its way — undefined if the shape has none.
function savedSlot(board, saved) {
  return board.slots.findIndex(function (s) {
    return s.cells[0][0] === saved.row && s.cells[0][1] === saved.col && wayOf(s) === saved.direction;
  });
}

// The first of the list's words written as a saved word is, not yet in the shape — two words spelt
// the same each come back.
function savedWord(board, play, saved) {
  var used = Object.keys(play.placed).map(function (s) { return play.placed[s]; });
  return board.words.findIndex(function (w, i) { return w.word === saved.word && !used.includes(i); });
}

// A saved word goes back only into a slot of the shape's, other than the starting word's and not
// already filled, and only if it is one of the list's words, not yet in, and that slot's length. The
// database already refuses anything but slot and word pairs.
function restoreWord(play, board, saved) {
  var slot = savedSlot(board, saved), word = savedWord(board, play, saved);
  var fits = [slot >= 0, !(slot in play.placed), word >= 0].every(Boolean) && board.words[word].letters.length === board.slots[slot].length;
  if (fits) play.placed[slot] = word;
}

// The shape as it was left, from its saved rows — none, and it's new, the starting word in. Nothing
// is set off, so a shape finished before doesn't celebrate again.
export function restoredCriss(board, rows) {
  var play = newCrissPlay(board);
  rows.slice(0, 1).forEach(function (row) {
    row.words.forEach(function (saved) { restoreWord(play, board, saved); });
  });
  return play;
}

// ---- Signing in mid-shape ----
// Signing in syncs the shape on screen, as a minesweeper board does. A player who hasn't placed a
// word picks up the shape saved elsewhere — that's opening it on a new device. One who has keeps the
// words on screen, and saves them.

function placedAny(play, board) {
  return placedWords(play, board).length > 0;
}

// What signing in saves of the shape on screen: nothing, if the player hasn't placed a word.
export function syncRows(puzzle, play, board) {
  return [wordsRow(puzzle, play, board)].filter(function () { return placedAny(play, board); });
}

// The play once the saved shape is joined to it: the words on screen, if any are placed, else the
// saved shape's. Nothing is set off.
export function joinedCriss(play, saved, board) {
  return { true: Object.assign({}, play, { events: [], clashes: [] }), false: saved }[placedAny(play, board)];
}
