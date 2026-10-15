import { createRequire } from 'module';
import { bookView, pageNumbers, printStyleOf, PRINT_STYLES, printedPages, leftOutNote } from '../../core/book-core.js';
import { minesBoard } from '../../core/minesweeper/play-core.js';
const require = createRequire(import.meta.url);
// MINE-0905 — tooling's own valid 6×6 Hard Canaries board, two canaries, passing its checks.
const CANARIES_FILE = require('../fixtures/MINE-0905.json');

const collections = () => [
  { slug: 'other', name: 'Other', description: 'Not this one.', created: '2026-10-01', puzzles: [{ id: 'WSCH-0001', number: 1 }] },
  {
    slug: 'issue-1', name: 'Issue #1', description: 'The first book.', created: '2026-10-03',
    puzzles: [{ id: 'WSCH-0003', number: 2 }, { id: 'WSCH-0001', number: 10 }, { id: 'WSCH-0002', number: 1 }],
  },
];

describe('book-core.js', () => {
  test('the book opens on a title page: the collection, the site, and where the answers are', () => {
    const book = bookView(collections(), 'issue-1', []);
    expect(book.found).toBe(true);
    expect(book.name).toBe('Issue #1');
    expect(book.description).toBe('The first book.');
    expect(book.address).toBe('dangrew.github.io/grew-puzzles');
    expect(book.answers).toBe("The answers are on the site: open Issue #1 in Collections, pick the puzzle's number, and flip its grid.");
  });

  test('then one page per puzzle, in number order, each headed with its number — the number its character goes by', () => {
    expect(bookView(collections(), 'issue-1', []).pages).toEqual([
      { heading: 'Puzzle 1', number: 1, kind: 'wordsearch', search: '?id=WSCH-0002' },
      { heading: 'Puzzle 2', number: 2, kind: 'wordsearch', search: '?id=WSCH-0003' },
      { heading: 'Puzzle 10', number: 10, kind: 'wordsearch', search: '?id=WSCH-0001' },
    ]);
  });

  test('a 32×40 maze takes its place in the book like any puzzle; a bigger one, or one the index doesn\'t list, is left out, its number skipped', () => {
    const mixed = [{
      slug: 'mixed', name: 'Mixed', description: '', created: '2026-10-08',
      puzzles: [{ id: 'MAZE-0003', number: 2 }, { id: 'WSCH-0001', number: 3 }, { id: 'MAZE-0001', number: 1 }, { id: 'MAZE-0009', number: 4 }],
    }];
    const index = [
      { hiddenId: 'MAZE-0001', width: 32, height: 40 },
      { hiddenId: 'MAZE-0003', width: 100, height: 100 },
      { hiddenId: 'MAZE-0004', width: 32, height: 40 },
    ];
    expect(bookView(mixed, 'mixed', index).pages).toEqual([
      { heading: 'Puzzle 1', number: 1, kind: 'maze', search: '?id=MAZE-0001' },
      { heading: 'Puzzle 3', number: 3, kind: 'wordsearch', search: '?id=WSCH-0001' },
    ]);
    expect(bookView(mixed, 'mixed', []).pages.map(p => p.number)).toEqual([3]);
  });

  test('a minesweeper board takes its place in number order, its file opened whatever its size', () => {
    const boards = [{
      slug: 'boards', name: 'Boards', description: '', created: '2026-10-12',
      puzzles: [{ id: 'WSCH-0001', number: 2 }, { id: 'MINE-0001', number: 1 }],
    }];
    expect(bookView(boards, 'boards', []).pages).toEqual([
      { heading: 'Puzzle 1', number: 1, kind: 'minesweeper', search: '?id=MINE-0001' },
      { heading: 'Puzzle 2', number: 2, kind: 'wordsearch', search: '?id=WSCH-0001' },
    ]);
  });

  test('once the boards are in, a board up to 30 squares along its longer side keeps its page; a bigger one is left out, by number', () => {
    const page = (number, kind) => ({ heading: `Puzzle ${number}`, number, kind, search: '' });
    const pages = [page(1, 'minesweeper'), page(2, 'wordsearch'), page(3, 'minesweeper'), page(4, 'maze'), page(5, 'minesweeper'), page(6, 'minesweeper')];
    const boards = [{ cols: 30, rows: 30 }, { sheets: [] }, { cols: 31, rows: 10 }, { cols: 32, rows: 40 }, { cols: 10, rows: 31 }, { cols: 10, rows: 10 }];
    expect(printedPages(pages, boards)).toEqual({
      pages: [page(1, 'minesweeper'), page(2, 'wordsearch'), page(4, 'maze'), page(6, 'minesweeper')],
      boards: [{ cols: 30, rows: 30 }, { sheets: [] }, { cols: 32, rows: 40 }, { cols: 10, rows: 10 }],
      left: [3, 5],
      screen: [],
    });
    expect(printedPages([], [])).toEqual({ pages: [], boards: [], left: [], screen: [] });
  });

  test('a criss-cross takes its place in number order, its file opened whatever its size', () => {
    const shapes = [{
      slug: 'shapes', name: 'Shapes', description: '', created: '2026-10-12',
      puzzles: [{ id: 'WSCH-0001', number: 2 }, { id: 'CRSS-0001', number: 1 }],
    }];
    expect(bookView(shapes, 'shapes', []).pages).toEqual([
      { heading: 'Puzzle 1', number: 1, kind: 'crisscross', search: '?id=CRSS-0001' },
      { heading: 'Puzzle 2', number: 2, kind: 'wordsearch', search: '?id=WSCH-0001' },
    ]);
  });

  test('once the shapes are in, a criss-cross whose squares and list fit one sheet keeps its page; any other is left out, by number', () => {
    const page = (number, kind) => ({ heading: `Puzzle ${number}`, number, kind, search: '' });
    const shape = (cols, rows, words) => ({ cols, rows, words: Array.from({ length: words }, () => ({ letters: 'CAT' })) });
    const pages = [page(1, 'crisscross'), page(2, 'wordsearch'), page(3, 'crisscross'), page(4, 'crisscross'), page(5, 'minesweeper')];
    const boards = [shape(17, 15, 20), { sheets: [] }, shape(29, 30, 20), shape(10, 10, 36), { cols: 10, rows: 10 }];
    expect(printedPages(pages, boards)).toEqual({
      pages: [page(1, 'crisscross'), page(2, 'wordsearch'), page(5, 'minesweeper')],
      boards: [shape(17, 15, 20), { sheets: [] }, { cols: 10, rows: 10 }],
      left: [3, 4],
      screen: [],
    });
  });

  test('a mosaic takes its place in number order, its file opened whatever its size', () => {
    const mosaics = [{
      slug: 'mosaics', name: 'Mosaics', description: '', created: '2026-10-15',
      puzzles: [{ id: 'WSCH-0001', number: 2 }, { id: 'MOSA-0001', number: 1 }],
    }];
    expect(bookView(mosaics, 'mosaics', []).pages).toEqual([
      { heading: 'Puzzle 1', number: 1, kind: 'mosaic', search: '?id=MOSA-0001' },
      { heading: 'Puzzle 2', number: 2, kind: 'wordsearch', search: '?id=WSCH-0001' },
    ]);
  });

  test('once the boards are in, a mosaic up to 30 squares along both sides keeps its page; a bigger one is left out, by number', () => {
    const page = (number, kind) => ({ heading: `Puzzle ${number}`, number, kind, search: '' });
    const pages = [page(1, 'mosaic'), page(2, 'wordsearch'), page(3, 'mosaic'), page(4, 'mosaic'), page(5, 'mosaic')];
    const boards = [{ cols: 30, rows: 30 }, { sheets: [] }, { cols: 30, rows: 38 }, { cols: 198, rows: 198 }, { cols: 12, rows: 12 }];
    expect(printedPages(pages, boards)).toEqual({
      pages: [page(1, 'mosaic'), page(2, 'wordsearch'), page(5, 'mosaic')],
      boards: [{ cols: 30, rows: 30 }, { sheets: [] }, { cols: 12, rows: 12 }],
      left: [3, 4],
      screen: [],
    });
  });

  test('a Reveal board never takes a page, whatever its size, and is named apart from those too big', () => {
    const page = (number, kind) => ({ heading: `Puzzle ${number}`, number, kind, search: '' });
    const pages = [page(1, 'minesweeper'), page(2, 'minesweeper'), page(3, 'minesweeper'), page(4, 'minesweeper')];
    const boards = [{ rule: 'reveal', cols: 10, rows: 10 }, { rule: 'vanilla', cols: 10, rows: 10 }, { rule: 'reveal', cols: 40, rows: 40 }, { rule: 'vanilla', cols: 40, rows: 40 }];
    expect(printedPages(pages, boards)).toEqual({
      pages: [page(2, 'minesweeper')],
      boards: [{ rule: 'vanilla', cols: 10, rows: 10 }],
      left: [4],
      screen: [1, 3],
    });
  });

  // TASK-204: a Canaries board plays on screen as a Reveal board does, so a book leaves it out the same.
  test('a Canaries board, read from its own file, never takes a page, and is named as playing on screen only', () => {
    const page = (number, kind) => ({ heading: `Puzzle ${number}`, number, kind, search: '' });
    const vanilla = { rule: 'vanilla', cols: 10, rows: 10 };
    const canaries = minesBoard(CANARIES_FILE);
    const printed = printedPages([page(1, 'minesweeper'), page(2, 'minesweeper')], [vanilla, canaries]);
    expect(printed).toEqual({ pages: [page(1, 'minesweeper')], boards: [vanilla], left: [], screen: [2] });
    expect(leftOutNote(printed.left, printed.screen)).toBe('Puzzle 2 plays on screen only, so it isn\'t in the book.');
  });

  test('the book\'s page names each board left out as too big to print; none left out, no note', () => {
    expect(leftOutNote([], [])).toBe('');
    expect(leftOutNote([7], [])).toBe('Puzzle 7 is too big to print, so it plays on the site only.');
    expect(leftOutNote([4, 7], [])).toBe('Puzzles 4 and 7 are too big to print, so they play on the site only.');
    expect(leftOutNote([2, 4, 7], [])).toBe('Puzzles 2, 4 and 7 are too big to print, so they play on the site only.');
  });

  test('the book\'s page names each Reveal board as playing on screen only, after any too big', () => {
    expect(leftOutNote([], [3])).toBe('Puzzle 3 plays on screen only, so it isn\'t in the book.');
    expect(leftOutNote([], [3, 5])).toBe('Puzzles 3 and 5 play on screen only, so they aren\'t in the book.');
    expect(leftOutNote([7], [3])).toBe('Puzzle 7 is too big to print, so it plays on the site only. Puzzle 3 plays on screen only, so it isn\'t in the book.');
  });

  test('nothing the book adds names a hidden ID', () => {
    const { pages, ...added } = bookView(collections(), 'issue-1', []);
    expect(JSON.stringify(added)).not.toContain('WSCH');
    expect(pages.map(p => p.heading).join()).not.toContain('WSCH');
  });

  test('the book prints in the style its address names — Colour, Black and white or Plain — else Plain', () => {
    expect(['colour', 'mono', 'plain'].map(s => printStyleOf(`?slug=issue-1&print=${s}`))).toEqual(['colour', 'mono', 'plain']);
    expect(printStyleOf('?slug=issue-1')).toBe('plain');
    expect(printStyleOf('?slug=issue-1&print=gold')).toBe('plain');
    expect(PRINT_STYLES).toEqual(['colour', 'mono', 'plain']);
  });

  test('the book leads back to its collection, slug and all', () => {
    expect(bookView(collections(), 'issue-1', []).back).toBe('collection.html?slug=issue-1');
    const odd = [{ slug: 'a b&c', name: 'Odd', description: '', created: '2026-10-03', puzzles: [] }];
    expect(bookView(odd, 'a b&c', []).back).toBe('collection.html?slug=a%20b%26c');
  });

  test('making the book leaves the collection\'s published order as it was', () => {
    const held = collections();
    bookView(held, 'issue-1', []);
    expect(held[1].puzzles.map(p => p.number)).toEqual([2, 10, 1]);
  });

  test('puzzle pages are numbered on from the title and copyright pages, even on the left and odd on the right', () => {
    const boards = [{ sheets: [] }, { sheets: ['Page 1 of 3', 'Page 2 of 3', 'Page 3 of 3'] }, { sheets: [] }];
    expect(pageNumbers(boards)).toEqual([
      [{ number: 3, side: 'right' }],
      [{ number: 4, side: 'left' }, { number: 5, side: 'right' }, { number: 6, side: 'left' }, { number: 7, side: 'right' }],
      [{ number: 8, side: 'left' }],
    ]);
    expect(pageNumbers([])).toEqual([]);
  });

  test('an address naming no collection the site holds has no book', () => {
    const missing = { found: false, name: 'Collection not found', description: '', address: '', answers: '', back: '', pages: [] };
    expect(bookView(collections(), 'nope', [])).toEqual(missing);
    expect(bookView(collections(), null, [])).toEqual(missing);
    expect(bookView([], 'issue-1', [])).toEqual(missing);
  });
});
