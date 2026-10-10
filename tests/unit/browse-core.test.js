import {
  PER_PAGE, COLLECTION_TYPE, filterOptions, noFilters, typeBreakdown, collectionHref, browseItems,
  browseState, browseSearch, browseList, pageCount, pageOf, clearFilters, nothingPicked,
  withSort, flipDir, dirLabel, tileDetail, playHref, totalLabel, pagerButtons, filterRows, picked, togglePick,
  filtersLabel, railItems, columnsOf, railView, toggleFinished, finishedPressed, filtersByProgress, withSignIn,
} from '../../core/browse-core.js';

const id = n => `WSCH-${String(n).padStart(4, '0')}`;
// A browse state in a place, nothing picked unless picks says.
const railState = (kind, picks = {}) => ({ kind, levels: [], types: [], finished: '', sort: 'difficulty', dir: 'desc', ...picks });
// Puzzle n was saved on day n of October, so the highest is the newest.
// The tiles a state shows, by hidden ID or collection name, from the indexes' entries.
const shown = (index, state, collections = []) => browseList(browseItems(index, collections), { kind: 'wordsearch', levels: [], ...state }, [])
  .map(i => i.hiddenId ?? i.title);
// Each place's types, the wordsearches' given, and the difficulties every kind offers.
const options = (wordsearch, maze = [], levels = []) => ({
  wordsearch: { levels, types: wordsearch }, maze: { levels, types: maze }, collections: { levels: [], types: [] },
});
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

  test('by date every puzzle shows newest first by created date, leaving the index as it was', () => {
    const index = [
      { hiddenId: id(1), created: '2026-09-30' },
      { hiddenId: id(2), created: '2026-11-01' },
      { hiddenId: id(3), created: '2026-10-15' },
    ];
    expect(shown(index, browseState('?sort=date', options([])))).toEqual([id(2), id(3), id(1)]);
    expect(index.map(p => p.hiddenId)).toEqual([id(1), id(2), id(3)]);
  });

  test('puzzles saved the same day order by the later hidden ID first, as numbers', () => {
    const index = [
      { hiddenId: 'WSCH-9999', created: '2026-10-02' },
      { hiddenId: 'WSCH-10000', created: '2026-10-02' },
      { hiddenId: 'WSCH-0002', created: '2026-10-02' },
    ];
    expect(shown(index, browseState('?sort=date', options([])))).toEqual(['WSCH-10000', 'WSCH-9999', 'WSCH-0002']);
  });

  test('each place offers its own puzzles\' difficulties and its kind\'s types, easiest first, and Collections neither', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla' }, { hiddenId: id(2), type: 'Mirra?e' }, { hiddenId: id(3), type: 'Missing' },
      { hiddenId: 'MAZE-0001', type: 'Keys' }, { hiddenId: 'MAZE-0002', type: 'Vanilla', difficulty: 'Extreme' },
    ];
    expect(filterOptions(index)).toEqual({
      wordsearch: { levels: ['Easy', 'Hard', 'Extreme'], types: ['Vanilla', 'Missing', 'Mirra?e'] },
      maze: { levels: ['Hard', 'Extreme'], types: ['Vanilla', 'Keys'] },
      collections: { levels: [], types: [] },
    });
    expect(filterOptions([])).toEqual({ wordsearch: { levels: [], types: [] }, maze: { levels: [], types: [] }, collections: { levels: [], types: [] } });
  });

  test('a place has nothing to filter only with no types and nobody signed in', () => {
    expect(noFilters([], false)).toBe(true);
    expect(noFilters([], true)).toBe(false);
    expect(noFilters(['Vanilla'], false)).toBe(false);
  });

  test('an address names its place — a kind, or Collections — and a place the site lacks is Wordsearches', () => {
    const both = options(['Vanilla'], ['Keys', 'Vanilla']);
    expect(browseState('?kind=maze&type=Keys', both)).toMatchObject({ kind: 'maze', types: ['Keys'] });
    expect(browseState('?kind=collections', both)).toMatchObject({ kind: 'collections', types: [] });
    expect(browseState('?kind=puzzle&type=Vanilla', both)).toMatchObject({ kind: 'wordsearch', types: ['Vanilla'] });
    expect(browseState('?kind=constructor', both).kind).toBe('wordsearch');
  });

  test('a type is taken with its place: a maze\'s type in Wordsearches is dropped', () => {
    const both = options(['Vanilla'], ['Keys', 'Vanilla']);
    expect(browseState('?type=Keys&type=Vanilla', both)).toMatchObject({ kind: 'wordsearch', types: ['Vanilla'] });
    expect(browseState('?kind=collections&type=Vanilla', both).types).toEqual([]);
  });

  test('the place rides first in the address — none for Wordsearches — and round-trips', () => {
    const state = { kind: 'maze', levels: [], finished: '', types: ['Keys'], sort: 'title', dir: 'asc' };
    expect(browseSearch(state)).toBe('?kind=maze&type=Keys&sort=title&dir=asc');
    expect(browseState(browseSearch(state), options([], ['Keys']))).toEqual(state);
    expect(browseSearch({ ...state, kind: 'collections', types: [], sort: 'difficulty', dir: 'desc' })).toBe('?kind=collections');
  });

  test('each place shows only its own tiles: Vanilla in Mazes is never a wordsearch', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'a' },
      { hiddenId: 'MAZE-0002', type: 'Vanilla', created: '2026-10-02', title: 'b' },
      { hiddenId: 'MAZE-0003', type: 'Keys', created: '2026-10-03', title: 'c' },
    ];
    const held = [collection('Mixed', '2026-10-04', [id(1), 'MAZE-0002'])];
    const by = (kind, types) => shown(index, { kind, finished: '', types, sort: 'date', dir: 'desc' }, held);
    expect(by('wordsearch', [])).toEqual([id(1)]);
    expect(by('maze', [])).toEqual(['MAZE-0003', 'MAZE-0002']);
    expect(by('maze', ['Vanilla'])).toEqual(['MAZE-0002']);
    expect(by('wordsearch', ['Vanilla'])).toEqual([id(1)]);
    expect(by('collections', [])).toEqual(['Mixed']);
  });

  test('a plain address is every type, by difficulty, easiest first', () => {
    expect(browseState('', options(['Missing', 'Vanilla']))).toEqual({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'difficulty', dir: 'desc' });
  });

  test('an address picks its types, sort and direction', () => {
    expect(browseState('?type=Vanilla&type=Missing&sort=title&dir=asc', options(['Missing', 'Vanilla'])))
      .toEqual({ kind: 'wordsearch', levels: [], finished: '', types: ['Missing', 'Vanilla'], sort: 'title', dir: 'asc' });
    expect(browseState('?sort=type&dir=desc', options(['Vanilla']))).toEqual({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'type', dir: 'desc' });
    expect(browseState('?sort=date', options(['Vanilla']))).toEqual({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'date', dir: 'desc' });
  });

  test('an address asking for a type no puzzle has, or a sort the page lacks, falls back', () => {
    expect(browseState('?type=Wildcards&type=Vanilla&sort=size&dir=up', options(['Vanilla'])))
      .toEqual({ kind: 'wordsearch', levels: [], finished: '', types: ['Vanilla'], sort: 'difficulty', dir: 'desc' });
    expect(browseState('?sort=constructor&dir=toString', options(['Vanilla']))).toEqual({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'difficulty', dir: 'desc' });
  });

  test('the default state has a plain address; anything else is spelled out', () => {
    expect(browseSearch({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'difficulty', dir: 'desc' })).toBe('');
    expect(browseSearch({ kind: 'wordsearch', levels: [], finished: '', types: ['Missing'], sort: 'difficulty', dir: 'desc' })).toBe('?type=Missing');
    expect(browseSearch({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'title', dir: 'desc' })).toBe('?sort=title');
    expect(browseSearch({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'date', dir: 'desc' })).toBe('?sort=date');
    expect(browseSearch({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'difficulty', dir: 'asc' })).toBe('?dir=asc');
    expect(browseSearch({ kind: 'wordsearch', levels: [], finished: '', types: ['Missing', 'Vanilla'], sort: 'type', dir: 'asc' }))
      .toBe('?type=Missing&type=Vanilla&sort=type&dir=asc');
  });

  test('a type\'s punctuation survives the round trip through the address', () => {
    const state = { kind: 'wordsearch', levels: [], finished: '', types: ['Mirra?e', 'A & B'], sort: 'title', dir: 'asc' };
    expect(browseSearch(state)).not.toContain('?e');
    expect(browseState(browseSearch(state), options(['A & B', 'Mirra?e', 'Vanilla']))).toEqual({ ...state, types: ['A & B', 'Mirra?e'] });
  });

  test('one picked type shows only that type; two show either; none shows all', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'a' },
      { hiddenId: id(2), type: 'Missing', created: '2026-10-02', title: 'b' },
      { hiddenId: id(3), type: 'Mirra?e', created: '2026-10-03', title: 'c' },
    ];
    const by = types => shown(index, { levels: [], finished: '', types, sort: 'date', dir: 'desc' });
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
    const by = (sort, dir) => shown(index, { levels: [], finished: '', types: [], sort, dir });
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
    const by = (sort, dir) => shown(index, { levels: [], finished: '', types: [], sort, dir });
    expect(by('title', 'asc')).toEqual([id(3), id(2), id(1)]);
    expect(by('type', 'desc')).toEqual([id(3), id(2), id(1)]);
    expect(by('date', 'asc')).toEqual([id(1), id(3), id(2)]);
  });

  test('by difficulty, Easy to Extreme, each difficulty by type then title A to Z', () => {
    const index = [
      { hiddenId: id(1), type: 'Mirra?e', created: '2026-10-01', title: 'Apples' },
      { hiddenId: id(2), type: 'Wildcards', created: '2026-10-02', title: 'Apples' },
      { hiddenId: id(3), type: 'Saga', created: '2026-10-03', title: 'Cars' },
      { hiddenId: id(4), type: 'Vanilla', created: '2026-10-04', title: 'Birds' },
      { hiddenId: id(5), type: 'Saga', created: '2026-10-05', title: 'Birds' },
      { hiddenId: id(6), type: 'Missing', created: '2026-10-06', title: 'Zoo' },
      { hiddenId: id(7), type: 'Brand New', created: '2026-10-07', title: 'Zebras' },
      { hiddenId: id(8), type: 'Repeats', created: '2026-10-08', title: 'Ants' },
    ];
    const by = dir => shown(index, { levels: [], finished: '', types: [], sort: 'difficulty', dir });
    expect(by('desc')).toEqual([id(7), id(4), id(5), id(3), id(2), id(6), id(8), id(1)]);
    // Flipped, the difficulties run the other way; the types and titles inside them don't.
    expect(by('asc')).toEqual([id(1), id(6), id(8), id(5), id(3), id(2), id(7), id(4)]);
  });

  test('by difficulty, filtered to Medium, every Saga A to Z then every Wildcards A to Z', () => {
    const index = [
      { hiddenId: id(1), type: 'Wildcards', created: '2026-10-01', title: 'Apples' },
      { hiddenId: id(2), type: 'Saga', created: '2026-10-02', title: 'Cars' },
      { hiddenId: id(3), type: 'Wildcards', created: '2026-10-03', title: 'Birds' },
      { hiddenId: id(4), type: 'Saga', created: '2026-10-04', title: 'Birds' },
    ];
    expect(shown(index, { levels: [], finished: '', types: ['Saga', 'Wildcards'], sort: 'difficulty', dir: 'desc' }))
      .toEqual([id(4), id(2), id(1), id(3)]);
  });

  test('by difficulty, a tile with the same type and title as another falls back to newest first, either way', () => {
    const index = [
      { hiddenId: id(1), type: 'Saga', created: '2026-10-01', title: 'Same' },
      { hiddenId: id(2), type: 'Saga', created: '2026-10-03', title: 'Same' },
      { hiddenId: id(3), type: 'Saga', created: '2026-10-02', title: 'Same' },
    ];
    expect(shown(index, { levels: [], finished: '', types: [], sort: 'difficulty', dir: 'desc' })).toEqual([id(2), id(3), id(1)]);
    expect(shown(index, { levels: [], finished: '', types: [], sort: 'difficulty', dir: 'asc' })).toEqual([id(2), id(3), id(1)]);
  });

  test('the popup is a Difficulty row, each in its colour, then a Type row, the kind\'s types in one list', () => {
    expect(filterRows({ levels: ['Easy', 'Hard'], types: ['Vanilla', 'Keys'] })).toEqual([
      { name: 'Difficulty', picks: [{ key: 'levels', value: 'Easy', tone: 'Easy' }, { key: 'levels', value: 'Hard', tone: 'Hard' }] },
      { name: 'Type', picks: [{ key: 'types', value: 'Vanilla', tone: '' }, { key: 'types', value: 'Keys', tone: '' }] },
    ]);
  });

  test('a row with nothing to pick is not there: Collections has neither', () => {
    expect(filterRows({ levels: [], types: ['Vanilla'] }).map(r => r.name)).toEqual(['Type']);
    expect(filterRows({ levels: ['Easy'], types: [] }).map(r => r.name)).toEqual(['Difficulty']);
    expect(filterRows({ levels: [], types: [] })).toEqual([]);
  });

  test('a pick is pressed while it is picked, in its own row only', () => {
    const state = { kind: 'maze', levels: ['Hard'], finished: '', types: ['Vanilla'] };
    expect(picked(state, { key: 'levels', value: 'Hard' })).toBe('true');
    expect(picked(state, { key: 'levels', value: 'Easy' })).toBe('false');
    expect(picked(state, { key: 'types', value: 'Vanilla' })).toBe('true');
    expect(picked(state, { key: 'types', value: 'Hard' })).toBe('false');
  });

  test('pressing a pick adds it, pressing it again takes it away, leaving the other row and the sort', () => {
    const state = { kind: 'maze', levels: ['Hard'], finished: '', types: ['Keys'], sort: 'title', dir: 'asc' };
    expect(togglePick(state, { key: 'levels', value: 'Easy' })).toEqual({ ...state, levels: ['Hard', 'Easy'] });
    expect(togglePick(state, { key: 'levels', value: 'Hard' })).toEqual({ ...state, levels: [] });
    expect(togglePick(state, { key: 'types', value: 'Vanilla' })).toEqual({ ...state, types: ['Keys', 'Vanilla'] });
    expect(togglePick({ ...state, types: ['Keys', 'Vanilla'] }, { key: 'types', value: 'Keys' }).types).toEqual(['Vanilla']);
    expect(state).toEqual({ kind: 'maze', levels: ['Hard'], finished: '', types: ['Keys'], sort: 'title', dir: 'asc' });
  });

  test('the Filters button counts the picks once there are any, difficulties too', () => {
    expect(filtersLabel({ levels: ['Hard'], finished: 'yes', types: ['Vanilla'] })).toBe('Filters · 3');
    expect(filtersLabel({ levels: [], finished: '', types: [] })).toBe('Filters');
    expect(filtersLabel({ levels: [], finished: '', types: ['Vanilla'] })).toBe('Filters · 1');
    expect(filtersLabel({ levels: [], finished: '', types: ['Vanilla', 'Missing'] })).toBe('Filters · 2');
  });

  test('clearing the filters unpicks the difficulties, the types and a Finished choice, keeping the sort', () => {
    expect(clearFilters({ kind: 'wordsearch', levels: ['Hard'], finished: 'yes', types: ['Missing', 'Vanilla'], sort: 'type', dir: 'asc' }))
      .toEqual({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'type', dir: 'asc' });
  });

  test('clear filters is offered only while a type or a Finished choice is picked', () => {
    expect(nothingPicked({ levels: [], finished: '', types: [] })).toBe(true);
    expect(nothingPicked({ levels: [], finished: '', types: ['Missing'] })).toBe(false);
    expect(nothingPicked({ levels: [], finished: 'no', types: [] })).toBe(false);
    expect(nothingPicked({ levels: ['Easy'], finished: '', types: [] })).toBe(false);
  });

  test('a Finished choice counts on the Filters button with the types', () => {
    expect(filtersLabel({ levels: [], finished: 'yes', types: [] })).toBe('Filters · 1');
    expect(filtersLabel({ levels: [], finished: 'no', types: ['Missing'] })).toBe('Filters · 2');
  });

  test('picking a Finished choice picks it, the other swaps it, and picking it again unpicks it, leaving the rest', () => {
    const state = { kind: 'wordsearch', levels: [], finished: '', types: ['Missing'], sort: 'title', dir: 'asc' };
    expect(toggleFinished(state, 'yes')).toEqual({ ...state, finished: 'yes' });
    expect(toggleFinished({ ...state, finished: 'yes' }, 'no')).toEqual({ ...state, finished: 'no' });
    expect(toggleFinished({ ...state, finished: 'no' }, 'no')).toEqual(state);
    expect(state.finished).toBe('');
  });

  test('a Finished choice shows pressed only while it is the one picked', () => {
    expect(finishedPressed({ levels: [], finished: 'yes' }, 'yes')).toBe('true');
    expect(finishedPressed({ levels: [], finished: 'yes' }, 'no')).toBe('false');
    expect(finishedPressed({ levels: [], finished: '' }, 'no')).toBe('false');
  });

  test('the tiles hang on the player\'s progress only while a Finished choice is picked', () => {
    expect(filtersByProgress({ levels: [], finished: 'yes' })).toBe('true');
    expect(filtersByProgress({ levels: [], finished: 'no' })).toBe('true');
    expect(filtersByProgress({ levels: [], finished: '' })).toBe('false');
  });

  test('signed out, a Finished choice is dropped; signed in, the state is kept as it is', () => {
    const state = { kind: 'wordsearch', levels: [], finished: 'yes', types: ['Missing'], sort: 'title', dir: 'asc' };
    expect(withSignIn(state, true)).toBe(state);
    expect(withSignIn(state, false)).toEqual({ ...state, finished: '' });
    expect(state.finished).toBe('yes');
  });

  test('an address picks Finished or Not finished; anything else is no choice', () => {
    expect(browseState('?finished=yes', options(['Vanilla'])).finished).toBe('yes');
    expect(browseState('?finished=no', options(['Vanilla'])).finished).toBe('no');
    expect(browseState('?finished=maybe', options(['Vanilla'])).finished).toBe('');
    expect(browseState('?finished=constructor', options(['Vanilla'])).finished).toBe('');
    expect(browseState('', options(['Vanilla'])).finished).toBe('');
  });

  test('a Finished choice rides in the address after the types, and round-trips', () => {
    const state = { kind: 'wordsearch', levels: [], finished: 'no', types: ['Missing'], sort: 'title', dir: 'asc' };
    expect(browseSearch(state)).toBe('?type=Missing&finished=no&sort=title&dir=asc');
    expect(browseSearch({ kind: 'wordsearch', levels: [], finished: 'yes', types: [], sort: 'difficulty', dir: 'desc' })).toBe('?finished=yes');
    expect(browseState(browseSearch(state), options(['Missing', 'Vanilla']))).toEqual(state);
  });

  test('Finished shows only the ✓ tiles — a collection once all its puzzles are done — and Not finished the rest', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'a' },
      { hiddenId: id(2), type: 'Missing', created: '2026-10-02', title: 'b' },
      { hiddenId: id(3), type: 'Missing', created: '2026-10-03', title: 'c' },
    ];
    const held = [collection('Done', '2026-10-04', [id(1), id(2)]), collection('Half', '2026-10-05', [id(2), id(3)])];
    const items = browseItems(index, held);
    const by = (kind, finished) => browseList(items, { kind, levels: [], finished, types: [], sort: 'date', dir: 'desc' }, [id(1), id(2)])
      .map(i => i.hiddenId ?? i.title);
    expect(by('wordsearch', 'yes')).toEqual([id(2), id(1)]);
    expect(by('wordsearch', 'no')).toEqual([id(3)]);
    expect(by('wordsearch', '')).toEqual([id(3), id(2), id(1)]);
    expect(by('collections', 'yes')).toEqual(['Done']);
    expect(by('collections', 'no')).toEqual(['Half']);
  });

  test('Finished narrows whatever the types show', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'a' },
      { hiddenId: id(2), type: 'Missing', created: '2026-10-02', title: 'b' },
      { hiddenId: id(3), type: 'Missing', created: '2026-10-03', title: 'c' },
    ];
    const list = (finished, types) => browseList(browseItems(index, []), { kind: 'wordsearch', levels: [], finished, types, sort: 'date', dir: 'desc' }, [id(1), id(2)])
      .map(i => i.hiddenId);
    expect(list('yes', ['Missing'])).toEqual([id(2)]);
    expect(list('no', ['Missing'])).toEqual([id(3)]);
    expect(list('yes', ['Missing', 'Vanilla'])).toEqual([id(2), id(1)]);
  });

  test('with nothing finished yet, Finished shows nothing and Not finished everything', () => {
    const items = browseItems(puzzles(2), []);
    expect(browseList(items, { kind: 'wordsearch', levels: [], finished: 'yes', types: [], sort: 'date', dir: 'desc' }, [])).toEqual([]);
    expect(browseList(items, { kind: 'wordsearch', levels: [], finished: 'no', types: [], sort: 'date', dir: 'desc' }, [])).toHaveLength(2);
  });

  test('picking a sort keeps the filter and direction', () => {
    expect(withSort({ kind: 'wordsearch', levels: [], finished: '', types: ['Missing'], sort: 'date', dir: 'asc' }, 'title')).toEqual({ kind: 'wordsearch', levels: [], finished: '', types: ['Missing'], sort: 'title', dir: 'asc' });
  });

  test('the direction flips each way, keeping the rest', () => {
    expect(flipDir({ kind: 'wordsearch', levels: [], finished: '', types: ['Missing'], sort: 'title', dir: 'desc' })).toEqual({ kind: 'wordsearch', levels: [], finished: '', types: ['Missing'], sort: 'title', dir: 'asc' });
    expect(flipDir({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'date', dir: 'asc' })).toEqual({ kind: 'wordsearch', levels: [], finished: '', types: [], sort: 'date', dir: 'desc' });
  });

  test('the direction reads in the sort\'s own terms', () => {
    expect(dirLabel({ sort: 'difficulty', dir: 'desc' })).toBe('Easiest first');
    expect(dirLabel({ sort: 'difficulty', dir: 'asc' })).toBe('Hardest first');
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

  test('a maze tile reads its size, width by height, under its type — only once its entry has both', () => {
    const maze = { hiddenId: 'MAZE-0001', type: 'Vanilla', created: '2026-10-02', title: 'Farm' };
    expect(tileDetail({ ...maze, width: 100, height: 60 })).toEqual(['Vanilla', '100×60', '2 Oct 2026']);
    expect(tileDetail(maze)).toEqual(['Vanilla', '2 Oct 2026']);
    expect(tileDetail({ ...maze, width: 100 })).toEqual(['Vanilla', '2 Oct 2026']);
    expect(tileDetail({ ...maze, height: 60 })).toEqual(['Vanilla', '2 Oct 2026']);
  });

  test('a tile links to the play page by hidden ID', () => {
    expect(playHref('WSCH-0007')).toBe('play.html?id=WSCH-0007');
    expect(playHref('a b&c')).toBe('play.html?id=a%20b%26c');
  });

  test('a maze tile links to the maze page by hidden ID; only the MAZE prefix goes there', () => {
    expect(playHref('MAZE-0001')).toBe('maze.html?id=MAZE-0001');
    expect(playHref('MAZEX-0001')).toBe('play.html?id=MAZEX-0001');
    expect(playHref('xMAZE-0001')).toBe('play.html?id=xMAZE-0001');
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

  test('a collection\'s breakdown counts each type it holds, most first, ties A to Z', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla' }, { hiddenId: id(2), type: 'Missing' }, { hiddenId: id(3), type: 'Vanilla' },
      { hiddenId: id(4), type: 'Wildcards' }, { hiddenId: id(5), type: 'Mirra?e' },
    ];
    expect(typeBreakdown(collection('A', '', [id(2), id(1), id(3)]), index)).toBe('2 Vanilla · 1 Missing');
    expect(typeBreakdown(collection('A', '', [id(4), id(2), id(5)]), index)).toBe('1 Mirra?e · 1 Missing · 1 Wildcards');
    expect(typeBreakdown(collection('A', '', [id(1)]), index)).toBe('1 Vanilla');
  });

  test('a collection of mazes alone reads its maze types the same way', () => {
    const maze = n => `MAZE-${String(n).padStart(4, '0')}`;
    const index = [
      { hiddenId: maze(1), type: 'Vanilla' }, { hiddenId: maze(2), type: 'Keys' },
      { hiddenId: maze(3), type: 'Vanilla' }, { hiddenId: maze(4), type: 'Vanilla' },
    ];
    expect(typeBreakdown(collection('A', '', [maze(2), maze(1), maze(3), maze(4)]), index)).toBe('3 Vanilla · 1 Keys');
  });

  test('a collection of both kinds splits its breakdown by kind, so two Vanillas are never added together', () => {
    const maze = n => `MAZE-${String(n).padStart(4, '0')}`;
    const words = Array.from({ length: 10 }, (_, i) => ({ hiddenId: id(i + 1), type: i < 8 ? 'Vanilla' : 'Missing' }));
    const index = [...words, { hiddenId: maze(1), type: 'Vanilla' }, { hiddenId: maze(2), type: 'Vanilla' }];
    // Mazes first in the collection, still Wordsearches first on the tile — the side bar's order.
    const ids = [maze(1), maze(2), ...words.map(w => w.hiddenId)];
    expect(typeBreakdown(collection('A', '', ids), index)).toBe('Wordsearches: 8 Vanilla · 2 Missing · Mazes: 2 Vanilla');
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
        ...index[0], kind: 'puzzle', place: 'wordsearch', tone: 'Easy', rank: 1, href: 'play.html?id=WSCH-0001',
        lines: ['Vanilla', '1 Oct 2026'], ids: [id(1)],
      },
      {
        ...index[1], kind: 'puzzle', place: 'wordsearch', tone: 'Easy', rank: 2, href: 'play.html?id=WSCH-0002',
        lines: ['Vanilla', '2 Oct 2026'], ids: [id(2)],
      },
      {
        kind: 'collection', place: 'collections', title: 'Issue', type: 'Collection', tone: 'Collection', created: '2026-10-05',
        rank: 0, href: 'collection.html?slug=issue', lines: ['About Issue', '2 Vanilla'], ids: [id(2), id(1)],
      },
    ]);
    expect(COLLECTION_TYPE).toBe('Collection');
  });

  test('a puzzle tile takes its kind\'s difficulty for its type as its tone, with none saved of its own', () => {
    const index = [
      { hiddenId: id(1), type: 'Mirra?e', created: '2026-10-01', title: 'a' },
      { hiddenId: 'MAZE-0002', type: 'Keys', created: '2026-10-01', title: 'b' },
    ];
    expect(browseItems(index, []).map(i => i.tone)).toEqual(['Extreme', 'Hard']);
  });

  test('a maze the owner saved as Hard wears Hard, whatever its type', () => {
    const index = [{ hiddenId: 'MAZE-0001', type: 'Vanilla', created: '2026-10-01', title: 'a', difficulty: 'Hard' }];
    expect(browseItems(index, [])[0].tone).toBe('Hard');
  });

  test('picking Hard shows every Hard maze whatever its type; Hard and Vanilla only the Hard Vanilla ones', () => {
    const index = [
      { hiddenId: 'MAZE-0001', type: 'Vanilla', created: '2026-10-01', title: 'a', difficulty: 'Hard' },
      { hiddenId: 'MAZE-0002', type: 'Vanilla', created: '2026-10-02', title: 'b' },
      { hiddenId: 'MAZE-0003', type: 'Keys', created: '2026-10-03', title: 'c' },
      { hiddenId: 'MAZE-0004', type: 'Keys', created: '2026-10-04', title: 'd', difficulty: 'Easy' },
    ];
    const by = (levels, types) => shown(index, { kind: 'maze', levels, finished: '', types, sort: 'date', dir: 'desc' });
    expect(by(['Hard'], [])).toEqual(['MAZE-0003', 'MAZE-0001']);
    expect(by(['Hard'], ['Vanilla'])).toEqual(['MAZE-0001']);
    expect(by(['Hard', 'Easy'], [])).toEqual(['MAZE-0004', 'MAZE-0003', 'MAZE-0002', 'MAZE-0001']);
    expect(by([], ['Keys'])).toEqual(['MAZE-0004', 'MAZE-0003']);
    expect(by([], [])).toEqual(['MAZE-0004', 'MAZE-0003', 'MAZE-0002', 'MAZE-0001']);
  });

  test('on Wordsearches a difficulty picks exactly the puzzles of the types at that level', () => {
    const index = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'a' },
      { hiddenId: id(2), type: 'Missing', created: '2026-10-02', title: 'b' },
      { hiddenId: id(3), type: 'Repeats', created: '2026-10-03', title: 'c' },
      { hiddenId: id(4), type: 'Saga', created: '2026-10-04', title: 'd' },
    ];
    const by = (levels, types) => shown(index, { levels, finished: '', types, sort: 'date', dir: 'desc' });
    expect(by(['Hard'], [])).toEqual(by([], ['Missing', 'Repeats']));
    expect(by(['Hard'], [])).toEqual([id(3), id(2)]);
    expect(by(['Hard'], ['Missing'])).toEqual([id(2)]);
  });

  test('sorted by difficulty, a maze saved as Hard sits among the Hard puzzles', () => {
    const index = [
      { hiddenId: 'MAZE-0001', type: 'Vanilla', created: '2026-10-01', title: 'a', difficulty: 'Hard' },
      { hiddenId: 'MAZE-0002', type: 'Keylecticodes', created: '2026-10-02', title: 'b' },
      { hiddenId: 'MAZE-0003', type: 'Keys', created: '2026-10-03', title: 'c' },
      { hiddenId: 'MAZE-0004', type: 'Collectibles', created: '2026-10-04', title: 'd' },
    ];
    expect(shown(index, { kind: 'maze', finished: '', types: [], sort: 'difficulty', dir: 'desc' }))
      .toEqual(['MAZE-0004', 'MAZE-0003', 'MAZE-0001', 'MAZE-0002']);
  });

  test('an address names a difficulty, a type or both, and round-trips; one the place lacks is dropped', () => {
    const offered = options([], ['Keys', 'Vanilla'], ['Easy', 'Hard']);
    expect(browseState('?kind=maze&difficulty=Hard', offered)).toMatchObject({ kind: 'maze', levels: ['Hard'], types: [] });
    expect(browseState('?kind=maze&type=Vanilla&difficulty=Hard', offered)).toMatchObject({ levels: ['Hard'], types: ['Vanilla'] });
    expect(browseState('?kind=maze&difficulty=Extreme&difficulty=Easy', offered).levels).toEqual(['Easy']);
    const state = { kind: 'maze', levels: ['Hard'], finished: '', types: ['Vanilla'], sort: 'difficulty', dir: 'desc' };
    expect(browseSearch(state)).toBe('?kind=maze&type=Vanilla&difficulty=Hard');
    expect(browseState(browseSearch(state), offered)).toEqual(state);
  });

  test('collections sort by name, by created date, and the same day by name', () => {
    const held = [collection('Charlie', '2026-10-02'), collection('Bravo', '2026-10-01'), collection('Alpha', '2026-10-01')];
    const by = (sort, dir) => shown([], { kind: 'collections', levels: [], finished: '', types: [], sort, dir }, held);
    expect(by('title', 'asc')).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(by('title', 'desc')).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(by('date', 'desc')).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(by('date', 'asc')).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(by('difficulty', 'desc')).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('the rail holds each puzzle in play\'s own browse tile, in the order given, a collection\'s puzzle too', () => {
    const items = browseItems(puzzles(3), [collection('Farm', '2026-10-09', [id(2)])]);
    const rail = railItems(items, [id(2), id(3)], railState('wordsearch'));
    expect(rail.map(i => i.hiddenId)).toEqual([id(2), id(3)]);
    expect(rail[0]).toBe(items.find(i => i.hiddenId === id(2)));
    expect(rail[0]).toMatchObject({ kind: 'puzzle', href: playHref(id(2)) });
    expect(railItems(items, [], railState('wordsearch'))).toEqual([]);
  });

  test('a kind\'s rail holds only that kind\'s puzzles, in the order given; Collections\' holds every kind', () => {
    const maze = { hiddenId: 'MAZE-0001', type: 'Vanilla', created: '2026-10-09', title: 'Maze 1' };
    const items = browseItems([...puzzles(2), maze], []);
    const playing = ['MAZE-0001', id(2), id(1)];
    expect(railItems(items, playing, railState('wordsearch')).map(i => i.hiddenId)).toEqual([id(2), id(1)]);
    expect(railItems(items, playing, railState('maze')).map(i => i.hiddenId)).toEqual(['MAZE-0001']);
    expect(railItems(items, playing, railState('collections')).map(i => i.hiddenId)).toEqual(playing);
  });

  test('the rail narrows to the Type and Difficulty picks as the grid does, and ignores the Finished choice', () => {
    const held = [
      { hiddenId: id(1), type: 'Vanilla', created: '2026-10-01', title: 'A' },
      { hiddenId: id(2), type: 'Missing', created: '2026-10-01', title: 'B' },
      { hiddenId: id(3), type: 'Vanilla', created: '2026-10-01', title: 'C' },
    ];
    const items = browseItems(held, []);
    const playing = [id(3), id(2), id(1)];
    const tone = items.find(i => i.hiddenId === id(2)).tone;
    const ids = state => railItems(items, playing, state).map(i => i.hiddenId);
    expect(ids(railState('wordsearch', { types: ['Vanilla'] }))).toEqual([id(3), id(1)]);
    expect(ids(railState('wordsearch', { types: ['Vanilla', 'Missing'] }))).toEqual(playing);
    expect(ids(railState('wordsearch', { levels: [tone] }))).toEqual([id(2)]);
    expect(ids(railState('wordsearch', { levels: [tone], types: ['Vanilla'] }))).toEqual([]);
    expect(ids(railState('wordsearch', { finished: 'yes' }))).toEqual(playing);
  });

  test('as many rail tiles fit as the grid has columns', () => {
    expect(columnsOf('180px')).toBe(1);
    expect(columnsOf('172.5px 172.5px 172.5px 172.5px')).toBe(4);
  });

  test('the rail shows a set of as many as fit, with ‹ only after the first and › only before the last', () => {
    const list = [1, 2, 3, 4, 5, 6, 7];
    expect(railView(list, 0, 3)).toEqual({ set: 0, tiles: [1, 2, 3], prev: false, next: true });
    expect(railView(list, 1, 3)).toEqual({ set: 1, tiles: [4, 5, 6], prev: true, next: true });
    expect(railView(list, 2, 3)).toEqual({ set: 2, tiles: [7], prev: true, next: false });
    expect(railView([1, 2, 3, 4, 5, 6], 1, 3)).toEqual({ set: 1, tiles: [4, 5, 6], prev: true, next: false });
  });

  test('everything fitting, the rail is one set with neither ‹ nor ›', () => {
    expect(railView([1, 2, 3], 0, 3)).toEqual({ set: 0, tiles: [1, 2, 3], prev: false, next: false });
    expect(railView([1], 0, 6)).toEqual({ set: 0, tiles: [1], prev: false, next: false });
    expect(railView([], 0, 6)).toEqual({ set: 0, tiles: [], prev: false, next: false });
  });

  test('a set past the last — more fit now, or fewer are in play — shows the last', () => {
    expect(railView([1, 2, 3, 4, 5], 2, 2)).toEqual({ set: 2, tiles: [5], prev: true, next: false });
    expect(railView([1, 2, 3, 4, 5], 2, 4)).toEqual({ set: 1, tiles: [5], prev: true, next: false });
    expect(railView([1, 2, 3, 4, 5], 4, 5)).toEqual({ set: 0, tiles: [1, 2, 3, 4, 5], prev: false, next: false });
  });
});
