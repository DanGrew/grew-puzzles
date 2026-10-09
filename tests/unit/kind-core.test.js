import {
  COLLECTIONS, kinds, kindOf, places, placeName, difficultyOf, difficulties, typesOf, placeParams, sideBar, sideMarks, markOf,
} from '../../core/kind-core.js';

const puzzle = (hiddenId, type) => ({ hiddenId, type, created: '2026-10-08', title: hiddenId });
const collection = name => ({ slug: name.toLowerCase(), name, description: '', created: '2026-10-08', puzzles: [] });

describe('kind-core.js', () => {
  test('the kinds, in the side bar\'s order: Wordsearches, then Mazes, each with its prefix and play page', () => {
    expect(kinds()).toEqual([
      { kind: 'wordsearch', name: 'Wordsearches', prefix: 'WSCH', page: 'play.html' },
      { kind: 'maze', name: 'Mazes', prefix: 'MAZE', page: 'maze.html' },
    ]);
  });

  test('a puzzle\'s kind is its hidden ID\'s prefix; any other prefix is a wordsearch', () => {
    expect(kindOf('WSCH-0001')).toBe('wordsearch');
    expect(kindOf('MAZE-0001')).toBe('maze');
    expect(kindOf('MAZEX-0001')).toBe('wordsearch');
    expect(kindOf('xMAZE-0001')).toBe('wordsearch');
    expect(kindOf('MAZE')).toBe('maze');
  });

  test('the places are each kind, then Collections, and each has its name', () => {
    expect(places()).toEqual(['wordsearch', 'maze', 'collections']);
    expect(COLLECTIONS).toBe('collections');
    expect(places().map(placeName)).toEqual(['Wordsearches', 'Mazes', 'Collections']);
  });

  test('a wordsearch\'s types: Vanilla Easy, Saga and Wildcards Medium, Missing and Repeats Hard, Mirra?e Extreme', () => {
    expect(['Vanilla', 'Saga', 'Wildcards', 'Missing', 'Repeats', 'Mirra?e'].map(t => difficultyOf('wordsearch', t)))
      .toEqual(['Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Extreme']);
  });

  test("a maze's types: Vanilla Easy, Collectibles and Code Breaker Medium, Keys Hard, Keylecticodes Extreme", () => {
    expect(['Vanilla', 'Collectibles', 'Code Breaker', 'Keys', 'Keylecticodes'].map(t => difficultyOf('maze', t)))
      .toEqual(['Easy', 'Medium', 'Medium', 'Hard', 'Extreme']);
  });

  test('a type is taken with its kind: another kind\'s type, or one the table lacks, is Easy', () => {
    expect(difficultyOf('wordsearch', 'Keys')).toBe('Easy');
    expect(difficultyOf('maze', 'Mirra?e')).toBe('Easy');
    expect(difficultyOf('maze', 'Brand New')).toBe('Easy');
    expect(difficultyOf('wordsearch', 'constructor')).toBe('Easy');
  });

  test('the difficulties run Easy to Extreme', () => {
    expect(difficulties()).toEqual(['Easy', 'Medium', 'Hard', 'Extreme']);
  });

  test('a kind\'s types are its puzzles\', once each, easiest first and A to Z within a difficulty', () => {
    const index = [
      puzzle('WSCH-0001', 'Mirra?e'), puzzle('WSCH-0002', 'Wildcards'), puzzle('WSCH-0003', 'Vanilla'),
      puzzle('WSCH-0004', 'Saga'), puzzle('WSCH-0005', 'Vanilla'), puzzle('MAZE-0001', 'Keys'), puzzle('MAZE-0002', 'Code Breaker'),
      puzzle('MAZE-0003', 'Collectibles'),
    ];
    expect(typesOf('wordsearch', index)).toEqual(['Vanilla', 'Saga', 'Wildcards', 'Mirra?e']);
    expect(typesOf('maze', index)).toEqual(['Code Breaker', 'Collectibles', 'Keys']);
    expect(typesOf('collections', index)).toEqual([]);
    expect(typesOf('maze', [])).toEqual([]);
  });

  test('two types of one difficulty go A to Z, whichever comes first', () => {
    expect(typesOf('wordsearch', [puzzle('WSCH-0001', 'Repeats'), puzzle('WSCH-0002', 'Missing')])).toEqual(['Missing', 'Repeats']);
    expect(typesOf('wordsearch', [puzzle('WSCH-0001', 'Missing'), puzzle('WSCH-0002', 'Repeats')])).toEqual(['Missing', 'Repeats']);
  });

  test('the address names the place — none for Wordsearches — then each type', () => {
    expect(placeParams('wordsearch', []).toString()).toBe('');
    expect(placeParams('wordsearch', ['Vanilla']).toString()).toBe('type=Vanilla');
    expect(placeParams('maze', ['Keys', 'Code Breaker']).toString()).toBe('kind=maze&type=Keys&type=Code+Breaker');
    expect(placeParams('collections', []).toString()).toBe('kind=collections');
  });

  test('the side bar lists each kind with its count and its types, each with its tone and address', () => {
    const index = [puzzle('WSCH-0001', 'Saga'), puzzle('WSCH-0002', 'Vanilla'), puzzle('MAZE-0001', 'Vanilla'), puzzle('MAZE-0002', 'Keys'),
      puzzle('MAZE-0003', 'Keys')];
    expect(sideBar(index, [collection('Issue')])).toEqual({
      kinds: [
        {
          mark: 'wordsearch', name: 'Wordsearches', count: '2', query: '',
          types: [
            { mark: 'wordsearch:Vanilla', name: 'Vanilla', tone: 'Easy', query: '?type=Vanilla' },
            { mark: 'wordsearch:Saga', name: 'Saga', tone: 'Medium', query: '?type=Saga' },
          ],
        },
        {
          mark: 'maze', name: 'Mazes', count: '3', query: '?kind=maze',
          types: [
            { mark: 'maze:Vanilla', name: 'Vanilla', tone: 'Easy', query: '?kind=maze&type=Vanilla' },
            { mark: 'maze:Keys', name: 'Keys', tone: 'Hard', query: '?kind=maze&type=Keys' },
          ],
        },
      ],
      collections: { count: '1', query: '?kind=collections', hidden: false },
    });
  });

  test('a kind with no puzzles still shows, counting 0 with no types; Collections hides with none', () => {
    const bar = sideBar([puzzle('WSCH-0001', 'Vanilla')], []);
    expect(bar.kinds[1]).toEqual({ mark: 'maze', name: 'Mazes', count: '0', query: '?kind=maze', types: [] });
    expect(bar.collections).toEqual({ count: '0', query: '?kind=collections', hidden: true });
  });

  test('a page is current for its place, and — one type picked alone — that type too', () => {
    expect(sideMarks('maze', [])).toEqual(['maze']);
    expect(sideMarks('maze', ['Keys'])).toEqual(['maze', 'maze:Keys']);
    expect(sideMarks('wordsearch', ['Saga', 'Vanilla'])).toEqual(['wordsearch']);
    expect(sideMarks('about', [])).toEqual(['about']);
  });

  test('an entry is the current page only when its mark is among the page\'s', () => {
    expect(markOf(['maze', 'maze:Keys'], 'maze:Keys')).toBe('page');
    expect(markOf(['maze', 'maze:Keys'], 'maze')).toBe('page');
    expect(markOf(['maze'], 'wordsearch')).toBe('false');
    expect(markOf([undefined], 'about')).toBe('false');
  });
});
