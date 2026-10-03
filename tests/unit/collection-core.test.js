import { slugOf, collectionView } from '../../core/collection-core.js';

const index = () => [
  { hiddenId: 'WSCH-0001', type: 'Vanilla', created: '2026-10-01', title: 'Farm Animals' },
  { hiddenId: 'WSCH-0002', type: 'Missing', created: '2026-10-02', title: 'Flowers' },
  { hiddenId: 'WSCH-0003', type: 'Vanilla', created: '2026-10-03', title: 'Birds' },
];
const collections = () => [
  { slug: 'other', name: 'Other', description: 'Not this one.', created: '2026-10-01', puzzles: [{ id: 'WSCH-0001', number: 1 }] },
  {
    slug: 'issue-1', name: 'Issue #1', description: 'The first book.', created: '2026-10-03',
    puzzles: [{ id: 'WSCH-0003', number: 2 }, { id: 'WSCH-0001', number: 10 }, { id: 'WSCH-0002', number: 1 }],
  },
];

describe('collection-core.js', () => {
  test('the address names its collection by slug, punctuation and all', () => {
    expect(slugOf('?slug=issue-1-remake')).toBe('issue-1-remake');
    expect(slugOf('?slug=a%20b%26c')).toBe('a b&c');
    expect(slugOf('')).toBe(null);
  });

  test('a collection page shows its name and description, then its puzzles in number order, numbered', () => {
    expect(collectionView(collections(), index(), 'issue-1')).toEqual({
      found: true, name: 'Issue #1', description: 'The first book.', book: 'book.html?slug=issue-1',
      tiles: [
        { number: '1', title: 'Flowers', type: 'Missing', lines: ['Missing', '2 Oct 2026'], href: 'play.html?id=WSCH-0002' },
        { number: '2', title: 'Birds', type: 'Vanilla', lines: ['Vanilla', '3 Oct 2026'], href: 'play.html?id=WSCH-0003' },
        { number: '10', title: 'Farm Animals', type: 'Vanilla', lines: ['Vanilla', '1 Oct 2026'], href: 'play.html?id=WSCH-0001' },
      ],
    });
  });

  test('Print book opens the collection\'s book, slug and all', () => {
    const odd = [{ slug: 'a b&c', name: 'Odd', description: '', created: '2026-10-03', puzzles: [] }];
    expect(collectionView(odd, index(), 'a b&c').book).toBe('book.html?slug=a%20b%26c');
  });

  test('showing a collection leaves its published order as it was', () => {
    const held = collections();
    collectionView(held, index(), 'issue-1');
    expect(held[1].puzzles.map(p => p.number)).toEqual([2, 10, 1]);
  });

  test('an address naming no collection the site holds says so, with no tiles', () => {
    const missing = { found: false, name: 'Collection not found', description: '', book: '', tiles: [] };
    expect(collectionView(collections(), index(), 'nope')).toEqual(missing);
    expect(collectionView(collections(), index(), null)).toEqual(missing);
    expect(collectionView([], index(), 'issue-1')).toEqual(missing);
  });
});
