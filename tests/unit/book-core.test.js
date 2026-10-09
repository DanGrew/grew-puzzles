import { bookView, pageNumbers, printStyleOf, PRINT_STYLES } from '../../core/book-core.js';

const collections = () => [
  { slug: 'other', name: 'Other', description: 'Not this one.', created: '2026-10-01', puzzles: [{ id: 'WSCH-0001', number: 1 }] },
  {
    slug: 'issue-1', name: 'Issue #1', description: 'The first book.', created: '2026-10-03',
    puzzles: [{ id: 'WSCH-0003', number: 2 }, { id: 'WSCH-0001', number: 10 }, { id: 'WSCH-0002', number: 1 }],
  },
];

describe('book-core.js', () => {
  test('the book opens on a title page: the collection, the site, and where the answers are', () => {
    const book = bookView(collections(), 'issue-1');
    expect(book.found).toBe(true);
    expect(book.name).toBe('Issue #1');
    expect(book.description).toBe('The first book.');
    expect(book.address).toBe('dangrew.github.io/grew-puzzles');
    expect(book.answers).toBe("The answers are on the site: open Issue #1 in Collections, pick the puzzle's number, and flip its grid.");
  });

  test('then one page per puzzle, in number order, each headed with its number — the number its character goes by', () => {
    expect(bookView(collections(), 'issue-1').pages).toEqual([
      { heading: 'Puzzle 1', number: 1, search: '?id=WSCH-0002' },
      { heading: 'Puzzle 2', number: 2, search: '?id=WSCH-0003' },
      { heading: 'Puzzle 10', number: 10, search: '?id=WSCH-0001' },
    ]);
  });

  test('a maze in the collection is left out of its book: it plays on the site alone, its number skipped', () => {
    const mixed = [{
      slug: 'mixed', name: 'Mixed', description: '', created: '2026-10-08',
      puzzles: [{ id: 'MAZE-0003', number: 2 }, { id: 'WSCH-0001', number: 3 }, { id: 'WSCH-0002', number: 1 }],
    }];
    expect(bookView(mixed, 'mixed').pages).toEqual([
      { heading: 'Puzzle 1', number: 1, search: '?id=WSCH-0002' },
      { heading: 'Puzzle 3', number: 3, search: '?id=WSCH-0001' },
    ]);
    const mazes = [{ slug: 'mazes', name: 'Mazes', description: '', created: '2026-10-08', puzzles: [{ id: 'MAZE-0001', number: 1 }] }];
    expect(bookView(mazes, 'mazes').pages).toEqual([]);
  });

  test('nothing the book adds names a hidden ID', () => {
    const { pages, ...added } = bookView(collections(), 'issue-1');
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
    expect(bookView(collections(), 'issue-1').back).toBe('collection.html?slug=issue-1');
    const odd = [{ slug: 'a b&c', name: 'Odd', description: '', created: '2026-10-03', puzzles: [] }];
    expect(bookView(odd, 'a b&c').back).toBe('collection.html?slug=a%20b%26c');
  });

  test('making the book leaves the collection\'s published order as it was', () => {
    const held = collections();
    bookView(held, 'issue-1');
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
    expect(bookView(collections(), 'nope')).toEqual(missing);
    expect(bookView(collections(), null)).toEqual(missing);
    expect(bookView([], 'issue-1')).toEqual(missing);
  });
});
