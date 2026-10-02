import {
  PER_PAGE, shownCollections, orderByPublicId, pageCount, pageOf,
  tileLabel, playHref, totalLabel, pagerButtons,
} from '../../core/browse-core.js';

const puzzles = n => Array.from({ length: n }, (_, i) => ({ publicId: i + 1, title: `T${i + 1}`, file: 'x' }));

describe('browse-core.js', () => {
  test('a page holds 24 puzzles', () => {
    expect(PER_PAGE).toBe(24);
  });

  test('only Vanilla shows, whatever else the index names', () => {
    expect(shownCollections({ collections: ['other', 'vanilla', 'more'] })).toEqual(['vanilla']);
    expect(shownCollections({ collections: ['other'] })).toEqual([]);
  });

  test('puzzles order by public ID, not manifest order, leaving the manifest as it was', () => {
    const manifest = [{ publicId: 10 }, { publicId: 2 }, { publicId: 1 }];
    expect(orderByPublicId(manifest).map(p => p.publicId)).toEqual([1, 2, 10]);
    expect(manifest.map(p => p.publicId)).toEqual([10, 2, 1]);
  });

  test('page count rounds up, and an empty collection still has one page', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(24)).toBe(1);
    expect(pageCount(25)).toBe(2);
    expect(pageCount(48)).toBe(2);
    expect(pageCount(49)).toBe(3);
  });

  test('each page holds the next 24 by public ID', () => {
    const all = puzzles(30).reverse();
    expect(pageOf(all, 1).map(p => p.publicId)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(pageOf(all, 2).map(p => p.publicId)).toEqual([25, 26, 27, 28, 29, 30]);
  });

  test('a tile reads collection name then public ID', () => {
    expect(tileLabel('Vanilla', 7)).toBe('Vanilla 7');
  });

  test('a tile links to the play page by collection and public ID', () => {
    expect(playHref('vanilla', 7)).toBe('play.html?collection=vanilla&id=7');
    expect(playHref('a b&c', 3)).toBe('play.html?collection=a%20b%26c&id=3');
  });

  test('the total reads in puzzles, singular for one', () => {
    expect(totalLabel(0)).toBe('0 puzzles');
    expect(totalLabel(1)).toBe('1 puzzle');
    expect(totalLabel(32)).toBe('32 puzzles');
  });

  test('one page has no pager', () => {
    expect(pagerButtons(1, 1)).toEqual([]);
  });

  test('the pager on the first page: previous off, page 1 current, next on', () => {
    expect(pagerButtons(1, 2)).toEqual([
      { label: '‹', target: 0, aria: 'Previous page', current: 'false', disabled: true },
      { label: '1', target: 1, aria: 'Page 1', current: 'page', disabled: false },
      { label: '2', target: 2, aria: 'Page 2', current: 'false', disabled: false },
      { label: '›', target: 2, aria: 'Next page', current: 'false', disabled: false },
    ]);
  });

  test('the pager on the last page: previous on, next off', () => {
    expect(pagerButtons(3, 3)).toEqual([
      { label: '‹', target: 2, aria: 'Previous page', current: 'false', disabled: false },
      { label: '1', target: 1, aria: 'Page 1', current: 'false', disabled: false },
      { label: '2', target: 2, aria: 'Page 2', current: 'false', disabled: false },
      { label: '3', target: 3, aria: 'Page 3', current: 'page', disabled: false },
      { label: '›', target: 4, aria: 'Next page', current: 'false', disabled: true },
    ]);
  });
});
