import {
  PER_PAGE, newestFirst, pageCount, pageOf, tileDetail, playHref, totalLabel, pagerButtons,
} from '../../core/browse-core.js';

const id = n => `WSCH-${String(n).padStart(4, '0')}`;
// Puzzle n was saved on day n of October, so the highest is the newest.
const puzzles = n => Array.from({ length: n }, (_, i) => ({
  hiddenId: id(i + 1), type: 'Vanilla', created: `2026-10-${String(i + 1).padStart(2, '0')}`, title: `T${i + 1}`,
}));

describe('browse-core.js', () => {
  test('a page holds 24 puzzles', () => {
    expect(PER_PAGE).toBe(24);
  });

  test('puzzles order newest first by created date, leaving the index as it was', () => {
    const index = [
      { hiddenId: id(1), created: '2026-09-30' },
      { hiddenId: id(2), created: '2026-11-01' },
      { hiddenId: id(3), created: '2026-10-15' },
    ];
    expect(newestFirst(index).map(p => p.hiddenId)).toEqual([id(2), id(3), id(1)]);
    expect(index.map(p => p.hiddenId)).toEqual([id(1), id(2), id(3)]);
  });

  test('puzzles saved the same day order by the later hidden ID first, as numbers', () => {
    const index = [
      { hiddenId: 'WSCH-9999', created: '2026-10-02' },
      { hiddenId: 'WSCH-10000', created: '2026-10-02' },
      { hiddenId: 'WSCH-0002', created: '2026-10-02' },
    ];
    expect(newestFirst(index).map(p => p.hiddenId)).toEqual(['WSCH-10000', 'WSCH-9999', 'WSCH-0002']);
  });

  test('page count rounds up, and an empty index still has one page', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(24)).toBe(1);
    expect(pageCount(25)).toBe(2);
    expect(pageCount(48)).toBe(2);
    expect(pageCount(49)).toBe(3);
  });

  test('each page holds the next 24, newest first', () => {
    const all = puzzles(30);
    expect(pageOf(all, 1).map(p => p.title)).toEqual(Array.from({ length: 24 }, (_, i) => `T${30 - i}`));
    expect(pageOf(all, 2).map(p => p.title)).toEqual(['T6', 'T5', 'T4', 'T3', 'T2', 'T1']);
  });

  test('beneath the title, a tile reads the type as written, then the created date, a line each', () => {
    expect(tileDetail({ hiddenId: id(3), type: 'Mirra?e', created: '2026-10-02', title: 'Farm' })).toEqual(['Mirra?e', '2 Oct 2026']);
  });

  test('a tile links to the play page by hidden ID', () => {
    expect(playHref('WSCH-0007')).toBe('play.html?id=WSCH-0007');
    expect(playHref('a b&c')).toBe('play.html?id=a%20b%26c');
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
