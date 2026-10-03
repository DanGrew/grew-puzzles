import {
  PER_PAGE, typesOf, browseState, browseSearch, browseList, pageCount, pageOf, filterChips, toggleType,
  clearTypes, noTypesPicked, withSort, flipDir, dirLabel, tileDetail, playHref, totalLabel, pagerButtons,
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

  test('by default every puzzle shows newest first by created date, leaving the index as it was', () => {
    const index = [
      { hiddenId: id(1), created: '2026-09-30' },
      { hiddenId: id(2), created: '2026-11-01' },
      { hiddenId: id(3), created: '2026-10-15' },
    ];
    expect(browseList(index, browseState('', [])).map(p => p.hiddenId)).toEqual([id(2), id(3), id(1)]);
    expect(index.map(p => p.hiddenId)).toEqual([id(1), id(2), id(3)]);
  });

  test('puzzles saved the same day order by the later hidden ID first, as numbers', () => {
    const index = [
      { hiddenId: 'WSCH-9999', created: '2026-10-02' },
      { hiddenId: 'WSCH-10000', created: '2026-10-02' },
      { hiddenId: 'WSCH-0002', created: '2026-10-02' },
    ];
    expect(browseList(index, browseState('', [])).map(p => p.hiddenId)).toEqual(['WSCH-10000', 'WSCH-9999', 'WSCH-0002']);
  });

  test('the filters are every type a puzzle has, once each, A to Z', () => {
    const index = [{ type: 'Vanilla' }, { type: 'Mirra?e' }, { type: 'Missing' }, { type: 'Vanilla' }];
    expect(typesOf(index)).toEqual(['Mirra?e', 'Missing', 'Vanilla']);
    expect(typesOf([])).toEqual([]);
  });

  test('a plain address is every type, by date, newest first', () => {
    expect(browseState('', ['Missing', 'Vanilla'])).toEqual({ types: [], sort: 'date', dir: 'desc' });
  });

  test('an address picks its types, sort and direction', () => {
    expect(browseState('?type=Vanilla&type=Missing&sort=title&dir=asc', ['Missing', 'Vanilla']))
      .toEqual({ types: ['Missing', 'Vanilla'], sort: 'title', dir: 'asc' });
    expect(browseState('?sort=type&dir=desc', ['Vanilla'])).toEqual({ types: [], sort: 'type', dir: 'desc' });
    expect(browseState('?sort=date', ['Vanilla'])).toEqual({ types: [], sort: 'date', dir: 'desc' });
  });

  test('an address asking for a type no puzzle has, or a sort the page lacks, falls back', () => {
    expect(browseState('?type=Wildcards&type=Vanilla&sort=size&dir=up', ['Vanilla']))
      .toEqual({ types: ['Vanilla'], sort: 'date', dir: 'desc' });
    expect(browseState('?sort=constructor&dir=toString', ['Vanilla'])).toEqual({ types: [], sort: 'date', dir: 'desc' });
  });

  test('the default state has a plain address; anything else is spelled out', () => {
    expect(browseSearch({ types: [], sort: 'date', dir: 'desc' })).toBe('');
    expect(browseSearch({ types: ['Missing'], sort: 'date', dir: 'desc' })).toBe('?type=Missing');
    expect(browseSearch({ types: [], sort: 'title', dir: 'desc' })).toBe('?sort=title');
    expect(browseSearch({ types: [], sort: 'date', dir: 'asc' })).toBe('?dir=asc');
    expect(browseSearch({ types: ['Missing', 'Vanilla'], sort: 'type', dir: 'asc' }))
      .toBe('?type=Missing&type=Vanilla&sort=type&dir=asc');
  });

  test('a type\'s punctuation survives the round trip through the address', () => {
    const state = { types: ['Mirra?e', 'A & B'], sort: 'title', dir: 'asc' };
    expect(browseSearch(state)).not.toContain('?e');
    expect(browseState(browseSearch(state), ['A & B', 'Mirra?e', 'Vanilla'])).toEqual({ ...state, types: ['A & B', 'Mirra?e'] });
  });

  test('one picked type shows only that type; two show either; none shows all', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'a' },
      { hiddenId: id(2), type: 'Missing', created: '2026-10-02', title: 'b' },
      { hiddenId: id(3), type: 'Mirra?e', created: '2026-10-03', title: 'c' },
    ];
    const by = types => browseList(index, { types, sort: 'date', dir: 'desc' }).map(p => p.hiddenId);
    expect(by(['Missing'])).toEqual([id(2)]);
    expect(by(['Missing', 'Vanilla'])).toEqual([id(2), id(1)]);
    expect(by([])).toEqual([id(3), id(2), id(1)]);
  });

  test('a sort orders by date, title or type, either way', () => {
    const index = [
      { hiddenId: id(1), type: 'Missing', created: '2026-10-02', title: 'Birds' },
      { hiddenId: id(2), type: 'Vanilla', created: '2026-10-01', title: 'Apples' },
      { hiddenId: id(3), type: 'Mirra?e', created: '2026-10-03', title: 'Cars' },
    ];
    const by = (sort, dir) => browseList(index, { types: [], sort, dir }).map(p => p.hiddenId);
    expect(by('date', 'asc')).toEqual([id(2), id(1), id(3)]);
    expect(by('date', 'desc')).toEqual([id(3), id(1), id(2)]);
    expect(by('title', 'asc')).toEqual([id(2), id(1), id(3)]);
    expect(by('title', 'desc')).toEqual([id(3), id(1), id(2)]);
    expect(by('type', 'asc')).toEqual([id(3), id(1), id(2)]);
    expect(by('type', 'desc')).toEqual([id(2), id(1), id(3)]);
  });

  test('ties fall back to newest first, whichever way the sort runs', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'Same' },
      { hiddenId: id(3), type: 'Vanilla', created: '2026-10-02', title: 'Same' },
      { hiddenId: id(2), type: 'Vanilla', created: '2026-10-02', title: 'Same' },
    ];
    const by = (sort, dir) => browseList(index, { types: [], sort, dir }).map(p => p.hiddenId);
    expect(by('title', 'asc')).toEqual([id(3), id(2), id(1)]);
    expect(by('type', 'desc')).toEqual([id(3), id(2), id(1)]);
    expect(by('date', 'asc')).toEqual([id(1), id(3), id(2)]);
  });

  test('a filter button per type, pressed when picked', () => {
    expect(filterChips(['Missing', 'Vanilla'], { types: ['Vanilla'] })).toEqual([
      { label: 'Missing', pressed: 'false' },
      { label: 'Vanilla', pressed: 'true' },
    ]);
  });

  test('picking a type adds it, picking it again takes it away, leaving the sort alone', () => {
    const state = { types: ['Missing'], sort: 'title', dir: 'asc' };
    expect(toggleType(state, 'Vanilla')).toEqual({ types: ['Missing', 'Vanilla'], sort: 'title', dir: 'asc' });
    expect(toggleType(state, 'Missing')).toEqual({ types: [], sort: 'title', dir: 'asc' });
    expect(state.types).toEqual(['Missing']);
  });

  test('clearing the filters keeps the sort', () => {
    expect(clearTypes({ types: ['Missing', 'Vanilla'], sort: 'type', dir: 'asc' })).toEqual({ types: [], sort: 'type', dir: 'asc' });
  });

  test('clear filters is offered only while a type is picked', () => {
    expect(noTypesPicked({ types: [] })).toBe(true);
    expect(noTypesPicked({ types: ['Missing'] })).toBe(false);
  });

  test('picking a sort keeps the filter and direction', () => {
    expect(withSort({ types: ['Missing'], sort: 'date', dir: 'asc' }, 'title')).toEqual({ types: ['Missing'], sort: 'title', dir: 'asc' });
  });

  test('the direction flips each way, keeping the rest', () => {
    expect(flipDir({ types: ['Missing'], sort: 'title', dir: 'desc' })).toEqual({ types: ['Missing'], sort: 'title', dir: 'asc' });
    expect(flipDir({ types: [], sort: 'date', dir: 'asc' })).toEqual({ types: [], sort: 'date', dir: 'desc' });
  });

  test('the direction reads in the sort\'s own terms', () => {
    expect(dirLabel({ sort: 'date', dir: 'desc' })).toBe('Newest first');
    expect(dirLabel({ sort: 'date', dir: 'asc' })).toBe('Oldest first');
    expect(dirLabel({ sort: 'title', dir: 'asc' })).toBe('A to Z');
    expect(dirLabel({ sort: 'title', dir: 'desc' })).toBe('Z to A');
    expect(dirLabel({ sort: 'type', dir: 'asc' })).toBe('A to Z');
    expect(dirLabel({ sort: 'type', dir: 'desc' })).toBe('Z to A');
  });

  test('page count rounds up, and an empty index still has one page', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(24)).toBe(1);
    expect(pageCount(25)).toBe(2);
    expect(pageCount(48)).toBe(2);
    expect(pageCount(49)).toBe(3);
  });

  test('each page holds the next 24 of the list, in its order', () => {
    const all = puzzles(30);
    expect(pageOf(all, 1).map(p => p.title)).toEqual(Array.from({ length: 24 }, (_, i) => `T${i + 1}`));
    expect(pageOf(all, 2).map(p => p.title)).toEqual(['T25', 'T26', 'T27', 'T28', 'T29', 'T30']);
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
