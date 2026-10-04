import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { playBoard } from '../../../core/wordsearch/play-core.js';
import { findRow } from '../../../core/wordsearch/progress-core.js';
import {
  readRange, morePages, startedPuzzles, puzzleFile, donePuzzles, playingPuzzles, tileDone
} from '../../../core/wordsearch/done-core.js';
const require = createRequire(import.meta.url);
const PUZZLE = require('../../fixtures/WSCH-0007.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
const linesOf = (id, puzzle, texts) => playBoard(puzzle).words
  .filter(w => texts.includes(w.text)).map(w => findRow(id, w));
const allLines = (id, puzzle) => linesOf(id, puzzle, puzzle.words.map(w => w.word));
const opened = puzzle => ({ status: 'fulfilled', value: puzzle });
const failed = () => ({ status: 'rejected', reason: new Error('No such puzzle') });

describe('reading every saved line', () => {
  it('reads 1000 rows at a time, each read starting where the last ended', () => {
    expect(readRange(0)).toEqual([0, 999]);
    expect(readRange(1)).toEqual([1000, 1999]);
    expect(readRange(2)).toEqual([2000, 2999]);
  });

  it('reads on after a full page, and stops after a short or empty one', () => {
    const rows = n => Array.from({ length: n }, () => ({}));
    expect(morePages(rows(1000), readRange(0))).toBe(true);
    expect(morePages(rows(1000), readRange(3))).toBe(true);
    expect(morePages(rows(999), readRange(0))).toBe(false);
    expect(morePages(rows(0), readRange(1))).toBe(false);
    expect(morePages(rows(3), [0, 2])).toBe(true);
  });
});

describe('which puzzle files are opened', () => {
  it('only those a tile stands for with a saved line, each once, in the tiles\' order', () => {
    const rows = [
      { puzzle: 'WSCH-0003' }, { puzzle: 'WSCH-0001' }, { puzzle: 'WSCH-0003' }, { puzzle: 'WSCH-0099' },
    ];
    const tiles = [{ ids: ['WSCH-0001'] }, { ids: ['WSCH-0002'] }, { ids: ['WSCH-0003'] }, { ids: ['WSCH-0003', 'WSCH-0001'] }];
    expect(startedPuzzles(rows, tiles)).toEqual(['WSCH-0001', 'WSCH-0003']);
  });

  it('none with nothing saved', () => {
    expect(startedPuzzles([], [{ ids: ['WSCH-0001'] }])).toEqual([]);
  });

  it('each from the puzzle\'s own file', () => {
    expect(puzzleFile('WSCH-0042')).toBe('../content/puzzles/wordsearch/WSCH-0042.json');
  });
});

describe('which puzzles are finished', () => {
  it('a puzzle with every word\'s line saved is finished', () => {
    expect(donePuzzles(allLines('WSCH-0007', PUZZLE), ['WSCH-0007'], [opened(PUZZLE)])).toEqual(['WSCH-0007']);
  });

  it('a puzzle missing one word\'s line is not', () => {
    const rows = linesOf('WSCH-0007', PUZZLE, ['Cat', 'Cow', 'Ewe', 'Hen', 'Ice cream', 'Map', 'Pig']);
    expect(donePuzzles(rows, ['WSCH-0007'], [opened(PUZZLE)])).toEqual([]);
  });

  it('only a puzzle\'s own lines count — the same lines saved for another puzzle finish only that one', () => {
    const rows = allLines('WSCH-0001', PUZZLE);
    expect(donePuzzles(rows, ['WSCH-0001', 'WSCH-0007'], [opened(PUZZLE), opened(PUZZLE)])).toEqual(['WSCH-0001']);
  });

  it('a Missing puzzle is finished on its last placed word — the missing one is never found', () => {
    const missing = { ...PUZZLE, type: 'Missing', words: PUZZLE.words.map(w => (w.word === 'Map' ? { word: 'Map', missing: true } : w)) };
    const rows = linesOf('WSCH-0007', missing, ['Cat', 'Cow', 'Ewe', 'Hen', 'Ice cream', 'Pig', 'Piglet']);
    expect(donePuzzles(rows, ['WSCH-0007'], [opened(missing)])).toEqual(['WSCH-0007']);
  });

  it('a puzzle whose file couldn\'t be opened is never finished, and the rest still are', () => {
    const rows = [...allLines('WSCH-0001', PUZZLE), ...allLines('WSCH-0002', PUZZLE)];
    expect(donePuzzles(rows, ['WSCH-0001', 'WSCH-0002'], [failed(), opened(PUZZLE)])).toEqual(['WSCH-0002']);
  });
});

describe('which puzzles are still in play', () => {
  const at = (rows, foundAt) => rows.map(row => ({ ...row, found_at: foundAt }));

  it('a started puzzle not finished is in play; a finished one is not', () => {
    const rows = [...at(allLines('WSCH-0001', PUZZLE), '2026-10-04T10:00:00+00:00'), ...at(linesOf('WSCH-0002', PUZZLE, ['Cat']), '2026-10-04T09:00:00+00:00')];
    const started = ['WSCH-0001', 'WSCH-0002'];
    const files = [opened(PUZZLE), opened(PUZZLE)];
    expect(playingPuzzles(rows, started, files, donePuzzles(rows, started, files))).toEqual(['WSCH-0002']);
  });

  it('the one found in most recently comes first, by its latest line, whatever order the lines are read in', () => {
    const rows = [
      { puzzle: 'WSCH-0001', found_at: '2026-10-01T08:00:00+00:00' },
      { puzzle: 'WSCH-0001', found_at: '2026-10-03T08:00:00+00:00' },
      { puzzle: 'WSCH-0001', found_at: '2026-10-02T08:00:00+00:00' },
      { puzzle: 'WSCH-0002', found_at: '2026-10-02T09:00:00+00:00' },
      { puzzle: 'WSCH-0003', found_at: '2026-10-04T08:00:00+00:00' },
      { puzzle: 'WSCH-0003', found_at: '2026-09-30T08:00:00+00:00' },
    ];
    const started = ['WSCH-0002', 'WSCH-0001', 'WSCH-0003'];
    const files = started.map(() => opened(PUZZLE));
    expect(playingPuzzles(rows, started, files, [])).toEqual(['WSCH-0003', 'WSCH-0001', 'WSCH-0002']);
  });

  it('a puzzle whose file couldn\'t be opened is never in play, and the rest still are', () => {
    const rows = [{ puzzle: 'WSCH-0001', found_at: '2026-10-01T08:00:00+00:00' }, { puzzle: 'WSCH-0002', found_at: '2026-10-01T09:00:00+00:00' }];
    expect(playingPuzzles(rows, ['WSCH-0001', 'WSCH-0002'], [opened(PUZZLE), failed()], [])).toEqual(['WSCH-0001']);
  });

  it('none with nothing started', () => {
    expect(playingPuzzles([], [], [], [])).toEqual([]);
  });
});

describe('which tiles are ticked', () => {
  it('a puzzle\'s tile, once that puzzle is finished', () => {
    expect(tileDone({ ids: ['WSCH-0001'] }, ['WSCH-0002', 'WSCH-0001'])).toBe(true);
    expect(tileDone({ ids: ['WSCH-0001'] }, ['WSCH-0002'])).toBe(false);
    expect(tileDone({ ids: ['WSCH-0001'] }, [])).toBe(false);
  });

  it('a collection\'s tile, once every puzzle in it is finished, and none while any isn\'t', () => {
    const issue = { ids: ['WSCH-0001', 'WSCH-0002', 'WSCH-0003'] };
    expect(tileDone(issue, ['WSCH-0003', 'WSCH-0001', 'WSCH-0002'])).toBe(true);
    expect(tileDone(issue, ['WSCH-0001', 'WSCH-0003'])).toBe(false);
    expect(tileDone(issue, ['WSCH-0002'])).toBe(false);
  });

  it('a collection with no puzzles is never ticked', () => {
    expect(tileDone({ ids: [] }, ['WSCH-0001'])).toBe(false);
  });
});
