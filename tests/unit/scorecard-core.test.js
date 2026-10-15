import { SHOWN, tabs, scoreItems, scoreGroups, toggleOpen, scoreTotal, signInLineHidden } from '../../core/scorecard-core.js';

const puzzle = (hiddenId, type, created, title, extra = {}) => ({ hiddenId, type, created, title, ...extra });

// Two wordsearches and a Kids one, two mazes — one Hard by the owner's pick — a board and a criss-cross.
const index = () => [
  puzzle('WSCH-0001', 'Vanilla', '2026-10-01', 'Farm'),
  puzzle('WSCH-0002', 'Missing', '2026-10-02', 'Flowers'),
  puzzle('WSCH-0003', 'Kids', '2026-10-03', 'Pets'),
  puzzle('MAZE-0001', 'Keys', '2026-10-02', 'Locked Out'),
  puzzle('MAZE-0002', 'Vanilla', '2026-10-04', 'Bee Line', { difficulty: 'Hard' }),
  puzzle('MINE-0001', 'Reveal', '2026-10-03', 'Minefield', { difficulty: 'Medium' }),
  puzzle('CRSS-0001', 'Vanilla', '2026-10-01', 'Planets'),
];

const titles = g => g.lines.map(l => l.title);

describe('scorecard-core.js', () => {
  test('the tabs run By kind, By type, By difficulty — By kind first, picked as the page opens', () => {
    expect(tabs()).toEqual([
      { by: 'kind', label: 'By kind' }, { by: 'type', label: 'By type' }, { by: 'difficulty', label: 'By difficulty' },
    ]);
  });

  test('every puzzle is a line of its kind, difficulty, code and play page, ticked by itself alone', () => {
    const items = scoreItems(index());
    expect(items[0]).toEqual({
      hiddenId: 'WSCH-0001', title: 'Farm', type: 'Vanilla', created: '2026-10-01', kind: 'wordsearch',
      tone: 'Easy', code: 'WSCH-0001', href: 'play.html?id=WSCH-0001', ids: ['WSCH-0001'],
    });
    expect(items.map(i => [i.kind, i.tone, i.href])).toEqual([
      ['wordsearch', 'Easy', 'play.html?id=WSCH-0001'], ['wordsearch', 'Hard', 'play.html?id=WSCH-0002'],
      ['wordsearch', 'Kids', 'play.html?id=WSCH-0003'], ['maze', 'Hard', 'maze.html?id=MAZE-0001'],
      ['maze', 'Hard', 'maze.html?id=MAZE-0002'], ['minesweeper', 'Medium', 'minesweeper.html?id=MINE-0001'],
      ['crisscross', 'Easy', 'crisscross.html?id=CRSS-0001'],
    ]);
  });

  test('By kind: a group a kind, in the side bar\'s order, in browse\'s order, each line\'s pill its type in its difficulty', () => {
    const groups = scoreGroups(scoreItems(index()), 'kind', [], true, []);
    expect(groups.map(g => [g.key, g.kindName, g.name, g.tone])).toEqual([
      ['wordsearch', '', 'Wordsearches', ''], ['maze', '', 'Mazes', ''],
      ['minesweeper', '', 'Minesweeper', ''], ['crisscross', '', 'Criss-cross', ''],
    ]);
    expect(titles(groups[0])).toEqual(['Farm', 'Flowers', 'Pets']);
    expect(groups[0].lines.map(l => l.pill)).toEqual([
      { label: 'Vanilla', tone: 'Easy' }, { label: 'Missing', tone: 'Hard' }, { label: 'Kids', tone: 'Kids' },
    ]);
    expect(groups[0].lines[2]).toEqual({
      title: 'Pets', href: 'play.html?id=WSCH-0003', code: 'WSCH-0003', pill: { label: 'Kids', tone: 'Kids' }, done: 'false',
    });
  });

  test('By type: a group a kind\'s type, in the Filters\' order, headed by its kind and coloured by its difficulty', () => {
    const groups = scoreGroups(scoreItems(index()), 'type', [], true, []);
    expect(groups.map(g => [g.key, g.kindName, g.name, g.tone])).toEqual([
      ['wordsearch:Vanilla', 'Wordsearches · ', 'Vanilla', 'Easy'],
      ['wordsearch:Missing', 'Wordsearches · ', 'Missing', 'Hard'],
      ['wordsearch:Kids', 'Wordsearches · ', 'Kids', 'Kids'],
      ['maze:Vanilla', 'Mazes · ', 'Vanilla', 'Easy'],
      ['maze:Keys', 'Mazes · ', 'Keys', 'Hard'],
      ['minesweeper:Reveal', 'Minesweeper · ', 'Reveal', 'Easy'],
      ['crisscross:Vanilla', 'Criss-cross · ', 'Vanilla', 'Easy'],
    ]);
    // Each line's pill is its own difficulty — a maze's or a board's its saved one.
    expect(groups.map(g => g.lines.map(l => l.pill))).toEqual([
      [{ label: 'Easy', tone: 'Easy' }], [{ label: 'Hard', tone: 'Hard' }], [{ label: 'Kids', tone: 'Kids' }],
      [{ label: 'Hard', tone: 'Hard' }], [{ label: 'Hard', tone: 'Hard' }],
      [{ label: 'Medium', tone: 'Medium' }], [{ label: 'Easy', tone: 'Easy' }],
    ]);
  });

  test('By difficulty: Easy to Extreme then Kids, none empty, each line\'s pill its kind and type', () => {
    const groups = scoreGroups(scoreItems(index()), 'difficulty', [], true, []);
    expect(groups.map(g => [g.key, g.kindName, g.name, g.tone])).toEqual([
      ['Easy', '', 'Easy', 'Easy'], ['Medium', '', 'Medium', 'Medium'], ['Hard', '', 'Hard', 'Hard'], ['Kids', '', 'Kids', 'Kids'],
    ]);
    expect(groups[2].lines.map(l => [l.title, l.pill])).toEqual([
      ['Flowers', { label: 'Wordsearch · Missing', tone: 'Hard' }],
      ['Bee Line', { label: 'Maze · Vanilla', tone: 'Hard' }],
      ['Locked Out', { label: 'Maze · Keys', tone: 'Hard' }],
    ]);
    expect(groups[0].lines.map(l => l.pill.label)).toEqual(['Wordsearch · Vanilla', 'Criss-cross · Vanilla']);
  });

  test('a group runs as browse sorts: difficulty with Kids last, then kind, type in the Filters\' order, title A to Z, newest on a tie', () => {
    const items = scoreItems([
      puzzle('WSCH-0001', 'Kids', '2026-10-01', 'A kids one'),
      puzzle('WSCH-0002', 'Missing', '2026-10-01', 'A hard one'),
      puzzle('CRSS-0001', 'Vanilla', '2026-10-01', 'A criss-cross'),
      puzzle('MAZE-0001', 'Vanilla', '2026-10-01', 'A maze'),
      puzzle('WSCH-0003', 'Wildcards', '2026-10-01', 'A medium one'),
      puzzle('WSCH-0004', 'Saga', '2026-10-01', 'Z medium one'),
      puzzle('WSCH-0005', 'Vanilla', '2026-10-01', 'Twin'),
      puzzle('WSCH-0006', 'Vanilla', '2026-10-03', 'Twin'),
      puzzle('WSCH-0007', 'Vanilla', '2026-10-03', 'Twin'),
      puzzle('WSCH-0008', 'Vanilla', '2026-10-01', 'Beta'),
    ]);
    const [all] = scoreGroups(items, 'kind', [], true, ['wordsearch']);
    // Easy Vanilla by title, the newest Twin first; then Medium — Saga before Wildcards, the
    // Filters' order, whatever their titles — then Hard, then Kids last.
    expect(all.lines.map(l => l.code)).toEqual([
      'WSCH-0008', 'WSCH-0007', 'WSCH-0006', 'WSCH-0005', 'WSCH-0004', 'WSCH-0003', 'WSCH-0002', 'WSCH-0001',
    ]);
    // A difficulty's group holds several kinds, in the side bar's order before type or title.
    expect(scoreGroups(items, 'difficulty', [], true, [])[0].lines.map(l => l.code)).toEqual([
      'WSCH-0008', 'WSCH-0007', 'WSCH-0006', 'WSCH-0005', 'MAZE-0001', 'CRSS-0001',
    ]);
  });

  test('signed in, a finished puzzle\'s line is ticked and each group counts finished of total', () => {
    const groups = scoreGroups(scoreItems(index()), 'kind', ['WSCH-0001', 'MAZE-0001', 'MAZE-0002'], true, []);
    expect(groups[0].lines.map(l => [l.title, l.done])).toEqual([['Farm', 'true'], ['Flowers', 'false'], ['Pets', 'false']]);
    expect(groups.map(g => [g.count, g.all])).toEqual([['1 / 3', 'false'], ['2 / 2', 'true'], ['0 / 1', 'false'], ['0 / 1', 'false']]);
  });

  test('signed out, nothing is ticked and each group only counts its puzzles, whatever the progress says', () => {
    const groups = scoreGroups(scoreItems(index()), 'kind', ['MAZE-0001', 'MAZE-0002'], false, []);
    expect(groups.map(g => [g.count, g.all])).toEqual([['3', 'false'], ['2', 'false'], ['1', 'false'], ['1', 'false']]);
    expect(groups.flatMap(g => g.lines.map(l => l.done))).not.toContain('true');
  });

  test('a group longer than eight shows its first eight and Show all, and every line once opened, then Show fewer', () => {
    expect(SHOWN).toBe(8);
    const many = n => Array.from({ length: n }, (_, i) => puzzle(`WSCH-${String(i + 1).padStart(4, '0')}`, 'Vanilla', '2026-10-01', `P${i + 1}`));
    const [closed] = scoreGroups(scoreItems(many(9)), 'kind', [], true, []);
    expect(closed.lines).toHaveLength(8);
    expect(closed.lines[0].title).toBe('P1');
    expect(closed.more).toBe('Show all 9');
    const [opened] = scoreGroups(scoreItems(many(9)), 'kind', [], true, ['wordsearch']);
    expect(opened.lines).toHaveLength(9);
    expect(opened.more).toBe('Show fewer');
    const [eight] = scoreGroups(scoreItems(many(8)), 'kind', [], true, []);
    expect(eight.lines).toHaveLength(8);
    expect(eight.more).toBe('');
    expect(scoreGroups(scoreItems(many(8)), 'kind', [], true, ['wordsearch'])[0].more).toBe('');
  });

  test('counting finished of total uses every line, the ones Show all hides too', () => {
    const many = Array.from({ length: 10 }, (_, i) => puzzle(`WSCH-${String(i + 1).padStart(4, '0')}`, 'Vanilla', '2026-10-01', `P${i + 1}`));
    const done = many.map(p => p.hiddenId);
    expect(scoreGroups(scoreItems(many), 'kind', done, true, [])[0]).toMatchObject({ count: '10 / 10', all: 'true' });
  });

  test('a site with no puzzles shows no groups', () => {
    expect(scoreGroups([], 'kind', [], true, [])).toEqual([]);
    expect(scoreGroups([], 'type', [], true, [])).toEqual([]);
    expect(scoreGroups([], 'difficulty', [], true, [])).toEqual([]);
  });

  test('showing the groups leaves the lines in the order they came', () => {
    const items = scoreItems(index());
    scoreGroups(items, 'kind', [], true, []);
    expect(items.map(i => i.hiddenId)).toEqual(index().map(p => p.hiddenId));
  });

  test('Show all opens a group, Show fewer closes it, the others left as they were', () => {
    expect(toggleOpen([], 'maze')).toEqual(['maze']);
    expect(toggleOpen(['wordsearch'], 'maze')).toEqual(['wordsearch', 'maze']);
    expect(toggleOpen(['wordsearch', 'maze'], 'maze')).toEqual(['wordsearch']);
  });

  test('the total: finished of every puzzle signed in; signed out, how many puzzles there are', () => {
    const items = scoreItems(index());
    expect(scoreTotal(items, ['WSCH-0001', 'MINE-0001', 'NOPE-0001'], true)).toBe('2 of 7 finished');
    expect(scoreTotal(items, [], true)).toBe('0 of 7 finished');
    expect(scoreTotal(items, ['WSCH-0001'], false)).toBe('7 puzzles');
    expect(scoreTotal(items.slice(0, 1), [], false)).toBe('1 puzzle');
    expect(scoreTotal([], [], false)).toBe('0 puzzles');
  });

  test('the sign-in line waits for the progress, then shows only with nobody signed in', () => {
    expect(signInLineHidden(false, false)).toBe(true);
    expect(signInLineHidden(true, false)).toBe(false);
    expect(signInLineHidden(true, true)).toBe(true);
  });
});
