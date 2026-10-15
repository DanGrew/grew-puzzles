// The collection book's rules: what its title page says, and which puzzle each page after it
// prints, in number order, headed with its number — the number its character goes by, as on the
// collection page. The pages themselves are each kind's own printout — a wordsearch's the play
// page's (ui/wordsearch/play-ui.js drawSheet), a maze's the maze page's (ui/maze/sheet-ui.js
// drawMazeSheet), a minesweeper board's the minesweeper page's (ui/minesweeper/sheet-ui.js
// drawMinesSheet), a criss-cross's the criss-cross page's (ui/crisscross/sheet-ui.js
// drawCrissSheet), a mosaic's the mosaic page's (ui/mosaic/sheet-ui.js drawMosaicSheet) — nothing
// here says how a puzzle looks. Nothing the book adds names a hidden ID
// or gives an answer: the answers stay on the site.
import { kindOf } from './kind-core.js';
import { mazePrints } from './maze/play-core.js';
import { minesPrints } from './minesweeper/play-core.js';
import { crissPrints } from './crisscross/play-core.js';
import { mosaicPrints } from './mosaic/play-core.js';
// The print styles a book or a puzzle's page prints in, as the side bar lists them: Colour, Black
// and white (mono), Plain.
export const PRINT_STYLES = ['colour', 'mono', 'plain'];

// The style a book's address asks for — Print book's choice on the collection page; Plain when
// it names none the site has.
export function printStyleOf(search) {
  const style = new URLSearchParams(search).get('print');
  return PRINT_STYLES.includes(style) ? style : 'plain';
}

export function bookView(collections, slug, mazes) {
  const collection = collections.find(c => c.slug === slug);
  const missing = { found: false, name: 'Collection not found', description: '', address: '', answers: '', back: '', pages: [] };
  return collection ? book(collection, mazes) : missing;
}

// Each puzzle's page numbers, in book order, given each one's board (play-core's playBoard): a
// puzzle prints one page, then a page more for each grid printed on a sheet of its own. The title
// page is page 1 and the copyright page 2, so the first puzzle starts on 3. Page 1 is a right-hand
// page, so every even number falls on the left, as KDP needs.
export function pageNumbers(boards) {
  let next = 3;
  return boards.map(board => Array.from({ length: 1 + board.sheets.length }, () => {
    const number = next++;
    return { number, side: number % 2 === 0 ? 'left' : 'right' };
  }));
}

// A wordsearch always prints in the book; a maze only at 32×40 (play-core's mazePrints), told by
// its width and height in the mazes' index (mazes, its entries). A bigger maze, or one the index
// doesn't list, plays on the site alone and is left out, its number skipped — as is any kind with
// no rule here. A minesweeper board's, a criss-cross's or a mosaic's file is opened whatever its
// size, and printedPages decides.
function printsIn(mazes) {
  const sizes = new Map(mazes.map(m => [m.hiddenId, m]));
  const PRINTS = {
    wordsearch: () => true,
    maze: id => [sizes.get(id)].filter(Boolean).some(m => mazePrints(m.width, m.height)),
    minesweeper: () => true,
    crisscross: () => true,
    mosaic: () => true,
  };
  return id => Object.hasOwn(PRINTS, kindOf(id)) && PRINTS[kindOf(id)](id);
}

// Why a minesweeper board takes no page: a Reveal board never prints, as paper can't cover a square
// (the product's TASK-174) — nor any board playing by its rule, a Canaries board's too (TASK-204);
// a Vanilla board only while its numbers stay readable on one sheet (play-core's minesPrints). ''
// when it prints.
function minesLeftOut(board) {
  if (board.rule === 'reveal') return 'screen';
  return minesPrints(board.cols, board.rows) ? '' : 'big';
}

// Which of the book's puzzles take a page, once each one's board is in (its kind's own, as
// pageNumbers takes): a minesweeper board as minesLeftOut says — told by its own file, as its index
// entry carries its size only with a difficulty — a criss-cross only while its squares and its
// list fit one (play-core's crissPrints), and a mosaic only up to 30 squares a side (play-core's
// mosaicPrints). A puzzle left out has its number skipped, and is named in the note on the book's
// page (leftOutNote): left those too big, screen the Reveal boards.
export function printedPages(pages, boards) {
  const LEFT_OUT = {
    minesweeper: minesLeftOut,
    crisscross: board => (crissPrints(board) ? '' : 'big'),
    mosaic: board => (mosaicPrints(board) ? '' : 'big'),
  };
  const why = pages.map((page, i) => (Object.hasOwn(LEFT_OUT, page.kind) ? LEFT_OUT[page.kind](boards[i]) : ''));
  const numbers = reason => pages.filter((_, i) => why[i] === reason).map(page => page.number);
  return {
    pages: pages.filter((_, i) => why[i] === ''),
    boards: boards.filter((_, i) => why[i] === ''),
    left: numbers('big'),
    screen: numbers('screen'),
  };
}

// The note on the book's page, on screen, naming each puzzle left out as too big to print, then each
// that plays on screen only — none, no note.
export function leftOutNote(numbers, screen) {
  return [bigNote(numbers), screenNote(screen)].filter(Boolean).join(' ');
}

function listOf(numbers) {
  return new Intl.ListFormat('en-GB').format(numbers.map(String));
}

function bigNote(numbers) {
  if (numbers.length === 0) return '';
  if (numbers.length === 1) return `Puzzle ${listOf(numbers)} is too big to print, so it plays on the site only.`;
  return `Puzzles ${listOf(numbers)} are too big to print, so they play on the site only.`;
}

function screenNote(numbers) {
  if (numbers.length === 0) return '';
  if (numbers.length === 1) return `Puzzle ${listOf(numbers)} plays on screen only, so it isn't in the book.`;
  return `Puzzles ${listOf(numbers)} play on screen only, so they aren't in the book.`;
}

function book(collection, mazes) {
  const prints = printsIn(mazes);
  const pages = collection.puzzles.filter(p => prints(p.id))
    .sort((a, b) => a.number - b.number)
    .map(({ id, number }) => ({ heading: `Puzzle ${number}`, number, kind: kindOf(id), search: `?id=${id}` }));
  return {
    found: true,
    name: collection.name,
    description: collection.description,
    address: 'dangrew.github.io/grew-puzzles',
    answers: `The answers are on the site: open ${collection.name} in Collections, pick the puzzle's number, and flip its grid.`,
    back: `collection.html?slug=${encodeURIComponent(collection.slug)}`,
    pages,
  };
}
