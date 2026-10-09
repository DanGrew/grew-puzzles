import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { doneMazes } from '../../../core/maze/done-core.js';
const require = createRequire(import.meta.url);
// core/maze/done-core.js, against the fixture with every element: a guide, two collectibles, Key 1,
// A, B and C, and six exits.
const MAZE = require('../../fixtures/MAZE-0001.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
const everything = () => [
  ...MAZE.guides, ...MAZE.collectibles, ...MAZE.keys, ...MAZE.letters, ...MAZE.exits
].map(s => [s.row, s.col]);
const rows = (puzzle, cells) => cells.map(([r, c]) => ({ puzzle, cell_row: r, cell_col: c }));
const opened = maze => ({ status: 'fulfilled', value: structuredClone(maze) });
const failed = () => ({ status: 'rejected', reason: new Error('No such puzzle') });

describe('which mazes are finished', () => {
  it('a maze with everything found, all six exits included, is finished', () => {
    expect(doneMazes(rows('MAZE-0001', everything()), ['MAZE-0001'], [opened(MAZE)])).toEqual(['MAZE-0001']);
  });

  it('a maze missing one exit is not', () => {
    const allButOne = everything().filter(([r, c]) => !(r === 2 && c === 4));
    expect(doneMazes(rows('MAZE-0001', allButOne), ['MAZE-0001'], [opened(MAZE)])).toEqual([]);
  });

  it('only a maze\'s own finds count — the same cells found in another finish only that one', () => {
    const files = [opened(MAZE), opened(MAZE)];
    expect(doneMazes(rows('MAZE-0002', everything()), ['MAZE-0001', 'MAZE-0002'], files)).toEqual(['MAZE-0002']);
  });

  it('a maze whose file couldn\'t be opened is never finished, and the rest still are', () => {
    const found = [...rows('MAZE-0001', everything()), ...rows('MAZE-0002', everything())];
    expect(doneMazes(found, ['MAZE-0001', 'MAZE-0002'], [failed(), opened(MAZE)])).toEqual(['MAZE-0002']);
  });

  it('a maze without letters is finished on its End', () => {
    const noLetters = { ...MAZE, letters: [], exits: [] };
    const cells = [...MAZE.guides, ...MAZE.collectibles, ...MAZE.keys, MAZE.end].map(s => [s.row, s.col]);
    expect(doneMazes(rows('MAZE-0001', cells), ['MAZE-0001'], [opened(noLetters)])).toEqual(['MAZE-0001']);
    expect(doneMazes(rows('MAZE-0001', cells.slice(0, -1)), ['MAZE-0001'], [opened(noLetters)])).toEqual([]);
  });
});
