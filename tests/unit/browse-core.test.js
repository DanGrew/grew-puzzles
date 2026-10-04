import {
  PER_PAGE, COLLECTIONS, COLLECTION_TYPE, typesOf, filterOptions, typeBreakdown, collectionHref, browseItems,
  browseState, browseSearch, browseList, pageCount, pageOf, toggleType, clearTypes, noTypesPicked,
  withSort, flipDir, dirLabel, tileDetail, playHref, totalLabel, pagerButtons, difficultyOf, filterRows, picked, toggleRow,
  filtersLabel,
} from '../../core/browse-core.js';

const id = n => `WSCH-${String(n).padStart(4, '0')}`;
// Puzzle n was saved on day n of October, so the highest is the newest.
// The tiles a state shows, by hidden ID or collection name, from the indexes' entries.
const shown = (index, state, collections = []) => browseList(browseItems(index, collections), state).map(i => i.hiddenId ?? i.title);
const collection = (name, created, ids = []) => ({
  slug: name.toLowerCase(), name, description: `About ${name}`, created, puzzles: ids.map((id, i) => ({ id, number: i + 1 })),
});
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
    expect(shown(index, browseState('', []))).toEqual([id(2), id(3), id(1)]);
    expect(index.map(p => p.hiddenId)).toEqual([id(1), id(2), id(3)]);
  });

  test('puzzles saved the same day order by the later hidden ID first, as numbers', () => {
    const index = [
      { hiddenId: 'WSCH-9999', created: '2026-10-02' },
      { hiddenId: 'WSCH-10000', created: '2026-10-02' },
      { hiddenId: 'WSCH-0002', created: '2026-10-02' },
    ];
    expect(shown(index, browseState('', []))).toEqual(['WSCH-10000', 'WSCH-9999', 'WSCH-0002']);
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
    const by = types => shown(index, { types, sort: 'date', dir: 'desc' });
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
    const by = (sort, dir) => shown(index, { types: [], sort, dir });
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
    const by = (sort, dir) => shown(index, { types: [], sort, dir });
    expect(by('title', 'asc')).toEqual([id(3), id(2), id(1)]);
    expect(by('type', 'desc')).toEqual([id(3), id(2), id(1)]);
    expect(by('date', 'asc')).toEqual([id(1), id(3), id(2)]);
  });

  test('each type has a difficulty, Easy to Extreme; a type the site has none for counts as Easy', () => {
    expect(['Vanilla', 'Saga', 'Wildcards', 'Missing', 'Repeats', 'Mirra?e'].map(difficultyOf))
      .toEqual(['Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Extreme']);
    expect(difficultyOf('Brand New')).toBe('Easy');
    expect(difficultyOf('constructor')).toBe('Easy');
  });

  test('the filter rows run Easy to Extreme, each with its types A to Z, then Collections with no name', () => {
    const types = ['Collections', 'Mirra?e', 'Missing', 'Repeats', 'Saga', 'Vanilla', 'Wildcards'];
    expect(filterRows(types)).toEqual([
      { name: 'Easy', tone: 'Easy', types: ['Vanilla'] },
      { name: 'Medium', tone: 'Medium', types: ['Saga', 'Wildcards'] },
      { name: 'Hard', tone: 'Hard', types: ['Missing', 'Repeats'] },
      { name: 'Extreme', tone: 'Extreme', types: ['Mirra?e'] },
      { name: '', tone: 'Collection', types: ['Collections'] },
    ]);
  });

  test('a difficulty with no type, or no collection, has no row; a type with no difficulty sits under Easy', () => {
    expect(filterRows(['Mirra?e', 'Brand New', 'Vanilla'])).toEqual([
      { name: 'Easy', tone: 'Easy', types: ['Brand New', 'Vanilla'] },
      { name: 'Extreme', tone: 'Extreme', types: ['Mirra?e'] },
    ]);
    expect(filterRows([])).toEqual([]);
  });

  test('a filter is pressed while every type it stands for is picked', () => {
    const state = { types: ['Missing', 'Vanilla'] };
    expect(picked(state, ['Vanilla'])).toBe('true');
    expect(picked(state, ['Saga'])).toBe('false');
    expect(picked(state, ['Missing', 'Vanilla'])).toBe('true');
    expect(picked(state, ['Missing', 'Repeats'])).toBe('false');
  });

  test('a difficulty\'s name picks the rest of its row, or unpicks a full row, leaving other rows and the sort', () => {
    const hard = ['Missing', 'Repeats'];
    const state = types => ({ types, sort: 'title', dir: 'asc' });
    expect(toggleRow(state(['Vanilla']), hard)).toEqual(state(['Vanilla', 'Missing', 'Repeats']));
    expect(toggleRow(state(['Repeats', 'Vanilla']), hard)).toEqual(state(['Repeats', 'Vanilla', 'Missing']));
    expect(toggleRow(state(['Missing', 'Vanilla', 'Repeats']), hard)).toEqual(state(['Vanilla']));
    const before = state(['Missing']);
    toggleRow(before, hard);
    expect(before.types).toEqual(['Missing']);
  });

  test('the Filters button counts the picks once there are any', () => {
    expect(filtersLabel({ types: [] })).toBe('Filters');
    expect(filtersLabel({ types: ['Vanilla'] })).toBe('Filters · 1');
    expect(filtersLabel({ types: ['Vanilla', 'Collections'] })).toBe('Filters · 2');
  });

  test('picking a type adds it, picking it again takes it away, leaving the sort alone', () => {
    const state = { types: ['Missing'], sort: 'title', dir: 'asc' };
    expect(toggleType(state, 'Vanilla')).toEqual({ types: ['Missing', 'Vanilla'], sort: 'title', dir: 'asc' });
    expect(toggleType(state, 'Missing')).toEqual({ types: [], sort: 'title', dir: 'asc' });
    expect(state.types).toEqual(['Missing']);
    expect(toggleType({ ...state, types: ['Missing', 'Vanilla'] }, 'Missing').types).toEqual(['Vanilla']);
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
    expect(totalLabel([])).toBe('0 puzzles');
    expect(totalLabel(browseItems(puzzles(1), []))).toBe('1 puzzle');
    expect(totalLabel(browseItems(puzzles(32), []))).toBe('32 puzzles');
  });

  test('the total counts collections apart from puzzles, and only once any show', () => {
    const one = [collection('A', '2026-10-01')];
    const two = [...one, collection('B', '2026-10-01')];
    expect(totalLabel(browseItems(puzzles(2), one))).toBe('2 puzzles · 1 collection');
    expect(totalLabel(browseItems(puzzles(1), two))).toBe('1 puzzle · 2 collections');
    expect(totalLabel(browseItems([], two))).toBe('2 collections');
    expect(totalLabel(browseItems([], one))).toBe('1 collection');
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

  test('a collection filter comes first, and only while a collection exists', () => {
    const index = [{ type: 'Vanilla' }, { type: 'Missing' }];
    expect(filterOptions(index, [collection('A', '2026-10-01')])).toEqual(['Collections', 'Missing', 'Vanilla']);
    expect(filterOptions(index, [])).toEqual(['Missing', 'Vanilla']);
    expect(COLLECTIONS).toBe('Collections');
  });

  test('a collection\'s breakdown counts each type it holds, most first, ties A to Z', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla' }, { hiddenId: id(2), type: 'Missing' }, { hiddenId: id(3), type: 'Vanilla' },
      { hiddenId: id(4), type: 'Wildcards' }, { hiddenId: id(5), type: 'Mirra?e' },
    ];
    expect(typeBreakdown(collection('A', '', [id(2), id(1), id(3)]), index)).toBe('2 Vanilla · 1 Missing');
    expect(typeBreakdown(collection('A', '', [id(4), id(2), id(5)]), index)).toBe('1 Mirra?e · 1 Missing · 1 Wildcards');
    expect(typeBreakdown(collection('A', '', [id(1)]), index)).toBe('1 Vanilla');
  });

  test('a collection tile links to its collection page by slug', () => {
    expect(collectionHref('issue-1-remake')).toBe('collection.html?slug=issue-1-remake');
    expect(collectionHref('a b&c')).toBe('collection.html?slug=a%20b%26c');
  });

  test('browse holds each puzzle once and each collection as one tile, never its puzzles again', () => {
    const index = puzzles(2);
    const items = browseItems(index, [collection('Issue', '2026-10-05', [id(2), id(1)])]);
    expect(items).toEqual([
      {
        ...index[0], kind: 'puzzle', filter: 'Vanilla', tone: 'Easy', rank: 1, href: 'play.html?id=WSCH-0001',
        lines: ['Vanilla', '1 Oct 2026'], ids: [id(1)],
      },
      {
        ...index[1], kind: 'puzzle', filter: 'Vanilla', tone: 'Easy', rank: 2, href: 'play.html?id=WSCH-0002',
        lines: ['Vanilla', '2 Oct 2026'], ids: [id(2)],
      },
      {
        kind: 'collection', title: 'Issue', type: 'Collection', filter: 'Collections', tone: 'Collection', created: '2026-10-05',
        rank: 0, href: 'collection.html?slug=issue', lines: ['About Issue', '2 Vanilla'], ids: [id(2), id(1)],
      },
    ]);
    expect(COLLECTION_TYPE).toBe('Collection');
  });

  test('a puzzle tile takes its type\'s difficulty as its tone', () => {
    const index = [{ hiddenId: id(1), type: 'Mirra?e', created: '2026-10-01', title: 'a' }];
    expect(browseItems(index, [])[0].tone).toBe('Extreme');
  });

  test('the Collections filter shows only collections; a type shows only its puzzles', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'a' },
      { hiddenId: id(2), type: 'Missing', created: '2026-10-02', title: 'b' },
    ];
    const held = [collection('Issue', '2026-10-03', [id(1), id(2)])];
    const by = types => shown(index, { types, sort: 'date', dir: 'desc' }, held);
    expect(by(['Collections'])).toEqual(['Issue']);
    expect(by(['Vanilla'])).toEqual([id(1)]);
    expect(by(['Collections', 'Missing'])).toEqual(['Issue', id(2)]);
    expect(by([])).toEqual(['Issue', id(2), id(1)]);
  });

  test('an address picks Collections only while the page offers it', () => {
    expect(browseState('?type=Collections', ['Collections', 'Vanilla']).types).toEqual(['Collections']);
    expect(browseState('?type=Collections', ['Vanilla']).types).toEqual([]);
  });

  test('collections sort among puzzles by name, as the type Collection, and by created date', () => {
    const index = [
      { hiddenId: id(1), type: 'Missing', created: '2026-10-01', title: 'Apples' },
      { hiddenId: id(2), type: 'Vanilla', created: '2026-10-03', title: 'Cars' },
    ];
    const held = [collection('Birds', '2026-10-02')];
    const by = (sort, dir) => shown(index, { types: [], sort, dir }, held);
    expect(by('title', 'asc')).toEqual([id(1), 'Birds', id(2)]);
    expect(by('title', 'desc')).toEqual([id(2), 'Birds', id(1)]);
    expect(by('type', 'asc')).toEqual(['Birds', id(1), id(2)]);
    expect(by('date', 'desc')).toEqual([id(2), 'Birds', id(1)]);
    expect(by('date', 'asc')).toEqual([id(1), 'Birds', id(2)]);
  });

  test('the same day, a puzzle sits before a collection, and two collections go by name', () => {
    const index = [{ hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'Zebras' }];
    const held = [collection('Bravo', '2026-10-01'), collection('Alpha', '2026-10-01')];
    expect(shown(index, { types: [], sort: 'date', dir: 'desc' }, held)).toEqual([id(1), 'Alpha', 'Bravo']);
    expect(shown(index, { types: [], sort: 'date', dir: 'asc' }, held)).toEqual([id(1), 'Alpha', 'Bravo']);
    expect(shown(index, { types: [], sort: 'type', dir: 'asc' }, held)).toEqual(['Alpha', 'Bravo', id(1)]);
  });
});
