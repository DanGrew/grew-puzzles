// The collection book's rules: what its title page says, and which puzzle each page after it
// prints, in number order, headed with its number — the number its character goes by, as on the
// collection page. The pages themselves are each kind's own printout — a wordsearch's the play
// page's (ui/wordsearch/play-ui.js drawSheet), a maze's the maze page's (ui/maze/sheet-ui.js
// drawMazeSheet), a minesweeper board's the minesweeper page's (ui/minesweeper/sheet-ui.js
// drawMinesSheet) — nothing here says how a puzzle looks. Nothing the book adds names a hidden ID or
// gives an answer: the answers stay on the site.
import { kindOf } from './kind-core.js';
import { mazePrints } from './maze/play-core.js';
import { minesPrints } from './minesweeper/play-core.js';
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
// no rule here. A minesweeper board's file is opened whatever its size, and printedPages decides.
function printsIn(mazes) {
  const sizes = new Map(mazes.map(m => [m.hiddenId, m]));
  const PRINTS = {
    wordsearch: () => true,
    maze: id => [sizes.get(id)].filter(Boolean).some(m => mazePrints(m.width, m.height)),
    minesweeper: () => true,
  };
  return id => Object.hasOwn(PRINTS, kindOf(id)) && PRINTS[kindOf(id)](id);
}

// Which of the book's puzzles take a page, once each one's board is in (its kind's own, as
// pageNumbers takes): a minesweeper board only while its numbers stay readable on one sheet
// (play-core's minesPrints) — told by its own file, as its index entry carries its size only with a
// difficulty. A board too big is left out, its number skipped, and named in the note on the book's
// page (leftOutNote).
export function printedPages(pages, boards) {
  const PRINTS = { minesweeper: board => minesPrints(board.cols, board.rows) };
  const prints = pages.map((page, i) => !Object.hasOwn(PRINTS, page.kind) || PRINTS[page.kind](boards[i]));
  return {
    pages: pages.filter((_, i) => prints[i]),
    boards: boards.filter((_, i) => prints[i]),
    left: pages.filter((_, i) => !prints[i]).map(page => page.number),
  };
}

// The note on the book's page, on screen, naming each puzzle left out as too big to print — none,
// no note.
export function leftOutNote(numbers) {
  const list = new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(numbers.map(String));
  if (numbers.length === 0) return '';
  if (numbers.length === 1) return `Puzzle ${list} is too big to print, so it plays on the site only.`;
  return `Puzzles ${list} are too big to print, so they play on the site only.`;
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
