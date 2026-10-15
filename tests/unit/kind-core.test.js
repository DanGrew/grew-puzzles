import {
  COLLECTIONS, kinds, indexFiles, kindOf, places, placeName, difficultyOf, difficulties, dotTone, puzzleDifficulty, levelsOf, typesOf, placeParams, sideBar, sideMarks, markOf,
} from '../../core/kind-core.js';

const puzzle = (hiddenId, type) => ({ hiddenId, type, created: '2026-10-08', title: hiddenId });
const collection = name => ({ slug: name.toLowerCase(), name, description: '', created: '2026-10-08', puzzles: [] });

describe('kind-core.js', () => {
  test('the kinds, in the side bar\'s order: Wordsearches, Mazes, Minesweeper, Criss-cross, then Mosaic, each with its names for one, several and short, its prefix and play page', () => {
    expect(kinds()).toEqual([
      { kind: 'wordsearch', name: 'Wordsearches', one: 'Wordsearch', many: 'Wordsearches', short: 'Words', prefix: 'WSCH', page: 'play.html' },
      { kind: 'maze', name: 'Mazes', one: 'Maze', many: 'Mazes', short: 'Mazes', prefix: 'MAZE', page: 'maze.html' },
      { kind: 'minesweeper', name: 'Minesweeper', one: 'Minesweeper', many: 'Minesweepers', short: 'Mines', prefix: 'MINE', page: 'minesweeper.html' },
      { kind: 'crisscross', name: 'Criss-cross', one: 'Criss-cross', many: 'Criss-crosses', short: 'Criss-cross', prefix: 'CRSS', page: 'crisscross.html' },
      { kind: 'mosaic', name: 'Mosaic', one: 'Mosaic', many: 'Mosaics', short: 'Mosaic', prefix: 'MOSA', page: 'mosaic.html' },
    ]);
  });

  test('each kind\'s puzzles are read from its own index, in the side bar\'s order', () => {
    expect(indexFiles()).toEqual([
      '../content/puzzles/wordsearch/index.json', '../content/puzzles/maze/index.json', '../content/puzzles/minesweeper/index.json',
      '../content/puzzles/crisscross/index.json', '../content/puzzles/mosaic/index.json',
    ]);
  });

  test('a puzzle\'s kind is its hidden ID\'s prefix; any other prefix is a wordsearch', () => {
    expect(kindOf('WSCH-0001')).toBe('wordsearch');
    expect(kindOf('MAZE-0001')).toBe('maze');
    expect(kindOf('MAZEX-0001')).toBe('wordsearch');
    expect(kindOf('xMAZE-0001')).toBe('wordsearch');
    expect(kindOf('MAZE')).toBe('maze');
    expect(kindOf('MINE-0001')).toBe('minesweeper');
    expect(kindOf('CRSS-0001')).toBe('crisscross');
    expect(kindOf('MOSA-0001')).toBe('mosaic');
  });

  test('the places are each kind, then Collections, and each has its name', () => {
    expect(places()).toEqual(['wordsearch', 'maze', 'minesweeper', 'crisscross', 'mosaic', 'collections']);
    expect(COLLECTIONS).toBe('collections');
    expect(places().map(placeName)).toEqual(['Wordsearches', 'Mazes', 'Minesweeper', 'Criss-cross', 'Mosaic', 'Collections']);
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

  test('the difficulties run Easy to Extreme, then Kids', () => {
    expect(difficulties()).toEqual(['Easy', 'Medium', 'Hard', 'Extreme', 'Kids']);
  });

  test('a Kids wordsearch is filed under Kids, its side bar dot in Kids\' own tone', () => {
    expect(difficultyOf('wordsearch', 'Kids')).toBe('Kids');
    expect(dotTone('wordsearch', 'Kids')).toBe('Kids');
    expect(levelsOf('wordsearch', [puzzle('WSCH-0001', 'Kids'), puzzle('WSCH-0002', 'Mirra?e'), puzzle('WSCH-0003', 'Vanilla')]))
      .toEqual(['Easy', 'Extreme', 'Kids']);
    expect(typesOf('wordsearch', [puzzle('WSCH-0001', 'Kids'), puzzle('WSCH-0002', 'Mirra?e'), puzzle('WSCH-0003', 'Vanilla')]))
      .toEqual(['Vanilla', 'Mirra?e', 'Kids']);
  });

  test('a puzzle\'s difficulty is the one saved with it, or with none saved its type\'s level', () => {
    expect(puzzleDifficulty({ ...puzzle('MAZE-0001', 'Vanilla'), difficulty: 'Hard' })).toBe('Hard');
    expect(puzzleDifficulty(puzzle('MAZE-0001', 'Keys'))).toBe('Hard');
    expect(puzzleDifficulty(puzzle('MAZE-0001', 'Keylecticodes'))).toBe('Extreme');
    expect(puzzleDifficulty(puzzle('WSCH-0001', 'Saga'))).toBe('Medium');
  });

  test('a kind\'s difficulties are its puzzles\', once each, Easy to Extreme', () => {
    const index = [
      { ...puzzle('MAZE-0001', 'Vanilla'), difficulty: 'Extreme' }, puzzle('MAZE-0002', 'Keys'), puzzle('MAZE-0003', 'Keys'),
      puzzle('WSCH-0001', 'Vanilla'),
    ];
    expect(levelsOf('maze', index)).toEqual(['Hard', 'Extreme']);
    expect(levelsOf('wordsearch', index)).toEqual(['Easy']);
    expect(levelsOf('collections', index)).toEqual([]);
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

  test('Vanilla leads its difficulty, whichever comes first, before a type A to Z puts ahead of it', () => {
    expect(typesOf('minesweeper', [puzzle('MINE-0001', 'Reveal'), puzzle('MINE-0002', 'Vanilla')])).toEqual(['Vanilla', 'Reveal']);
    expect(typesOf('minesweeper', [puzzle('MINE-0001', 'Vanilla'), puzzle('MINE-0002', 'Reveal')])).toEqual(['Vanilla', 'Reveal']);
    expect(typesOf('minesweeper', [puzzle('MINE-0001', 'Zigzag'), puzzle('MINE-0002', 'Vanilla')])).toEqual(['Vanilla', 'Zigzag']);
  });

  // The product's TASK-177: Minesweeper's types build up, each a rule more than the one before.
  test('Minesweeper\'s types go Vanilla, Reveal, Keys, Limited Flags, whichever comes first, then any other A to Z', () => {
    const boards = ['Limited Flags', 'Keys', 'Alpha', 'Reveal', 'Vanilla', 'Aardvark'].map((type, i) => puzzle(`MINE-000${i + 1}`, type));
    expect(typesOf('minesweeper', boards)).toEqual(['Vanilla', 'Reveal', 'Keys', 'Limited Flags', 'Aardvark', 'Alpha']);
    expect(typesOf('minesweeper', [...boards].reverse())).toEqual(['Vanilla', 'Reveal', 'Keys', 'Limited Flags', 'Aardvark', 'Alpha']);
    // Another kind's types of the same names keep A to Z.
    const mazes = ['Reveal', 'Keys', 'Limited Flags'].map((type, i) => puzzle(`MAZE-000${i + 1}`, type));
    expect(typesOf('maze', mazes)).toEqual(['Limited Flags', 'Reveal', 'Keys']);
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

  test('a wordsearch type\'s dot is its difficulty\'s tone; a maze type\'s its own shade, blue to violet', () => {
    expect(['Vanilla', 'Saga', 'Missing', 'Mirra?e'].map(t => dotTone('wordsearch', t))).toEqual(['Easy', 'Medium', 'Hard', 'Extreme']);
    expect(['Vanilla', 'Collectibles', 'Code Breaker', 'Keys', 'Keylecticodes'].map(t => dotTone('maze', t)))
      .toEqual(['Sky', 'Azure', 'Periwinkle', 'Lavender', 'Violet']);
    expect(dotTone('maze', 'Brand New')).toBe('Sky');
    expect(dotTone('maze', 'Mirra?e')).toBe('Sky');
    expect(dotTone('maze', 'constructor')).toBe('Sky');
  });

  test('a minesweeper type\'s dot is its difficulty\'s tone, as a wordsearch type\'s is: Vanilla Easy', () => {
    expect(dotTone('minesweeper', 'Vanilla')).toBe('Easy');
    expect(dotTone('minesweeper', 'Keys')).toBe('Easy');
  });

  test('a criss-cross type\'s dot is its difficulty\'s tone too: Vanilla Easy, never a maze\'s shade', () => {
    expect(dotTone('crisscross', 'Vanilla')).toBe('Easy');
    expect(dotTone('crisscross', 'Keys')).toBe('Easy');
    expect(dotTone('crisscross', 'Brand New')).toBe('Easy');
  });

  test('a mosaic type\'s dot is its difficulty\'s tone too: Vanilla Easy, never a maze\'s shade', () => {
    expect(dotTone('mosaic', 'Vanilla')).toBe('Easy');
    expect(dotTone('mosaic', 'Keys')).toBe('Easy');
  });

  test('the side bar lists each kind with its count and its types, each with its dot\'s tone and address', () => {
    const index = [puzzle('WSCH-0001', 'Saga'), puzzle('WSCH-0002', 'Vanilla'), puzzle('MAZE-0001', 'Vanilla'), puzzle('MAZE-0002', 'Keys'),
      puzzle('MAZE-0003', 'Keys'), { ...puzzle('MINE-0001', 'Vanilla'), difficulty: 'Hard' }, puzzle('MINE-0002', 'Vanilla'),
      puzzle('CRSS-0001', 'Vanilla'), { ...puzzle('MOSA-0001', 'Vanilla'), difficulty: 'Hard' }, puzzle('MOSA-0002', 'Vanilla')];
    expect(sideBar(index, [collection('Issue')])).toEqual({
      kinds: [
        {
          mark: 'wordsearch', name: 'Wordsearches', short: 'Words', count: '2', query: '',
          types: [
            { mark: 'wordsearch:Vanilla', name: 'Vanilla', tone: 'Easy', query: '?type=Vanilla' },
            { mark: 'wordsearch:Saga', name: 'Saga', tone: 'Medium', query: '?type=Saga' },
          ],
        },
        {
          mark: 'maze', name: 'Mazes', short: 'Mazes', count: '3', query: '?kind=maze',
          types: [
            { mark: 'maze:Vanilla', name: 'Vanilla', tone: 'Sky', query: '?kind=maze&type=Vanilla' },
            { mark: 'maze:Keys', name: 'Keys', tone: 'Lavender', query: '?kind=maze&type=Keys' },
          ],
        },
        {
          mark: 'minesweeper', name: 'Minesweeper', short: 'Mines', count: '2', query: '?kind=minesweeper',
          types: [{ mark: 'minesweeper:Vanilla', name: 'Vanilla', tone: 'Easy', query: '?kind=minesweeper&type=Vanilla' }],
        },
        {
          mark: 'crisscross', name: 'Criss-cross', short: 'Criss-cross', count: '1', query: '?kind=crisscross',
          types: [{ mark: 'crisscross:Vanilla', name: 'Vanilla', tone: 'Easy', query: '?kind=crisscross&type=Vanilla' }],
        },
        {
          mark: 'mosaic', name: 'Mosaic', short: 'Mosaic', count: '2', query: '?kind=mosaic',
          types: [{ mark: 'mosaic:Vanilla', name: 'Vanilla', tone: 'Easy', query: '?kind=mosaic&type=Vanilla' }],
        },
      ],
      collections: { count: '1', query: '?kind=collections', hidden: false },
    });
  });

  test('a kind with no puzzles still shows, counting 0 with no types; Collections hides with none', () => {
    const bar = sideBar([puzzle('WSCH-0001', 'Vanilla')], []);
    expect(bar.kinds[1]).toEqual({ mark: 'maze', name: 'Mazes', short: 'Mazes', count: '0', query: '?kind=maze', types: [] });
    expect(bar.kinds[2]).toEqual({ mark: 'minesweeper', name: 'Minesweeper', short: 'Mines', count: '0', query: '?kind=minesweeper', types: [] });
    expect(bar.kinds[3]).toEqual({ mark: 'crisscross', name: 'Criss-cross', short: 'Criss-cross', count: '0', query: '?kind=crisscross', types: [] });
    expect(bar.kinds[4]).toEqual({ mark: 'mosaic', name: 'Mosaic', short: 'Mosaic', count: '0', query: '?kind=mosaic', types: [] });
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
