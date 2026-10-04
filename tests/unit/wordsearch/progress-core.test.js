import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { playBoard } from '../../../core/wordsearch/play-core.js';
import {
  findRow, savedRows, restoredFinds, savedAnswer, queued, attempted, keptQueue, unsaved, saveLine
} from '../../../core/wordsearch/progress-core.js';
const require = createRequire(import.meta.url);
const PUZZLE = require('../../fixtures/WSCH-0007.json');

const HINT = 'Sign in to save your progress — or just play.';
const NOTE = 'Progress not saved — reconnecting';

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let WORDS;
beforeEach(() => {
  WORDS = playBoard(PUZZLE).words;
});
const at = text => WORDS.findIndex(w => w.text === text);
const saved = (words, text) => findRow('WSCH-0007', words[words.findIndex(w => w.text === text)]);

describe('what a find saves', () => {
  it('saves the puzzle and the word\'s line — page, start cell and direction — and nothing else', () => {
    expect(findRow('WSCH-0007', WORDS[at('Cat')])).toEqual({ puzzle: 'WSCH-0007', page: 0, start_row: 4, start_col: 2, direction: 'N' });
    expect(findRow('WSCH-0042', WORDS[at('Hen')])).toEqual({ puzzle: 'WSCH-0042', page: 0, start_row: 6, start_col: 3, direction: 'NE' });
  });
});

describe('a puzzle reopened', () => {
  it('finds the words whose lines were saved, in list order', () => {
    expect(restoredFinds([saved(WORDS, 'Hen'), saved(WORDS, 'Cat'), saved(WORDS, 'Map')], WORDS)).toEqual([at('Cat'), at('Hen'), at('Map')]);
  });

  it('finds nothing with nothing saved', () => {
    expect(restoredFinds([], WORDS)).toEqual([]);
  });

  it('finds no word for a line that differs in page, start row, start column or direction', () => {
    const cat = saved(WORDS, 'Cat');
    [{ page: 1 }, { start_row: 3 }, { start_col: 3 }, { direction: 'S' }].forEach(change => {
      expect(restoredFinds([{ ...cat, ...change }], WORDS)).toEqual([]);
    });
  });

  it('never finds a missing word, which has no line', () => {
    const words = playBoard({ ...PUZZLE, words: [{ word: 'Goat', missing: true }, ...PUZZLE.words] }).words;
    expect(restoredFinds([saved(words, 'Cat')], words)).toEqual([1]);
  });

  it('brings back exactly the copies of a repeated word that were found', () => {
    const cup = (row, col, direction) => ({ word: 'Cup', grid: 0, start: { row: row, col: col }, direction: direction, length: 3 });
    const words = playBoard({ ...PUZZLE, words: [cup(0, 0, 'E'), cup(0, 4, 'E'), cup(1, 2, 'W'), cup(2, 0, 'S'), cup(4, 4, 'E')] }).words;
    expect(restoredFinds([findRow('WSCH-0007', words[3]), findRow('WSCH-0007', words[1])], words)).toEqual([1, 3]);
  });

  it('tells pages apart: a line on Page 2 never finds the word on the same cells of Page 1', () => {
    const word = (text, grid) => ({ word: text, grid: grid, start: { row: 0, col: 0 }, direction: 'E', length: 3 });
    const words = playBoard({
      ...PUZZLE, words: [word('Cat', 0), word('Dog', 1)],
      grids: [{ rows: ['CATX', 'XXXX', 'XXXX', 'XXXX'] }, { rows: ['DOGX', 'XXXX', 'XXXX', 'XXXX'] }]
    }).words;
    expect(restoredFinds([findRow('WSCH-0007', words[1])], words)).toEqual([1]);
  });

  it('reads the saved lines from a read\'s answer, and none from a read that failed', () => {
    const rows = [saved(WORDS, 'Cat')];
    expect(savedRows({ data: rows, error: null })).toBe(rows);
    expect(savedRows({ data: null, error: { message: 'Failed to fetch', code: '' } })).toEqual([]);
  });
});

describe('a save\'s answer', () => {
  it('is saved when the save went through', () => {
    expect(savedAnswer({ error: null })).toBe(true);
  });

  it('is saved when the line was already saved — the same line is one find', () => {
    expect(savedAnswer({ error: { code: '23505', message: 'duplicate key value' } })).toBe(true);
  });

  it('is not saved when the save never arrived, or was refused for anything else', () => {
    expect(savedAnswer({ error: { code: '', message: 'TypeError: Failed to fetch' } })).toBe(false);
    expect(savedAnswer({ error: { code: '42501', message: 'row-level security' } })).toBe(false);
  });
});

describe('finds waiting to be saved', () => {
  const a = { puzzle: 'WSCH-0007', page: 0, start_row: 4, start_col: 2, direction: 'N' };
  const b = { puzzle: 'WSCH-0007', page: 0, start_row: 6, start_col: 3, direction: 'NE' };

  it('waits with no failed tries when first made', () => {
    expect(queued([], a)).toEqual([{ row: a, failed: 0 }]);
    expect(queued([{ row: a, failed: 2 }], b)).toEqual([{ row: a, failed: 2 }, { row: b, failed: 0 }]);
  });

  it('leaves once saved, the others still waiting', () => {
    expect(attempted([{ row: a, failed: 1 }, { row: b, failed: 0 }], a, true)).toEqual([{ row: b, failed: 0 }]);
  });

  it('counts a failed try against that find alone', () => {
    expect(attempted([{ row: a, failed: 1 }, { row: b, failed: 0 }], b, false)).toEqual([{ row: a, failed: 1 }, { row: b, failed: 1 }]);
  });

  it('tells apart two finds whose lines read the same: each is its own row', () => {
    const twin = { ...a };
    expect(attempted([{ row: a, failed: 0 }, { row: twin, failed: 0 }], twin, true)).toEqual([{ row: a, failed: 0 }]);
  });

  it('leaves the queue alone for a find no longer waiting', () => {
    expect(attempted([{ row: b, failed: 0 }], a, false)).toEqual([{ row: b, failed: 0 }]);
  });

  it('is tried again only while it waits', () => {
    expect(unsaved([{ row: a, failed: 1 }, { row: b, failed: 0 }], a)).toEqual([a]);
    expect(unsaved([{ row: b, failed: 0 }], a)).toEqual([]);
  });

  it('is dropped on signing out, and kept while signed in', () => {
    const queue = [{ row: a, failed: 3 }];
    expect(keptQueue(true, queue)).toBe(queue);
    expect(keptQueue(false, queue)).toEqual([]);
  });
});

describe('the line under the words', () => {
  const waiting = failed => [{ row: {}, failed: 0 }, { row: {}, failed: failed }];

  it('signed out, invites the player to sign in — however the saves stood', () => {
    expect(saveLine(false, [])).toEqual({ text: HINT, shown: true });
    expect(saveLine(false, waiting(5))).toEqual({ text: HINT, shown: true });
  });

  it('signed in, says nothing while every find is saved', () => {
    expect(saveLine(true, [])).toEqual({ text: '', shown: false });
  });

  it('signed in, says nothing for a save that is only slow, or failed once', () => {
    expect(saveLine(true, waiting(0))).toEqual({ text: '', shown: false });
    expect(saveLine(true, waiting(1))).toEqual({ text: '', shown: false });
  });

  it('signed in, notes the find isn\'t saved once its retry has failed too', () => {
    expect(saveLine(true, waiting(2))).toEqual({ text: NOTE, shown: true });
    expect(saveLine(true, waiting(7))).toEqual({ text: NOTE, shown: true });
  });
});
