import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { doneMazes, playingMazes, mazeLastPlayed } from '../../../core/maze/done-core.js';
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

describe('which mazes are still in play', () => {
  const place = (puzzle, r, c) => ({ puzzle, cell_row: r, cell_col: c });
  const start = () => [MAZE.start.row, MAZE.start.col];

  it('a maze moved off its start is in play, though nothing in it is found', () => {
    expect(playingMazes([place('MAZE-0001', 3, 1)], [], ['MAZE-0001'], [opened(MAZE)], [])).toEqual(['MAZE-0001']);
  });

  it('a maze with something found is in play, though the player stands on its start', () => {
    const found = rows('MAZE-0001', everything().slice(0, 1));
    expect(playingMazes([place('MAZE-0001', ...start())], found, ['MAZE-0001'], [opened(MAZE)], [])).toEqual(['MAZE-0001']);
  });

  it('a maze only opened — its place still the start, nothing found — is not in play', () => {
    expect(playingMazes([place('MAZE-0001', ...start())], [], ['MAZE-0001'], [opened(MAZE)], [])).toEqual([]);
  });

  it('only a maze\'s own place and finds count', () => {
    const files = [opened(MAZE), opened(MAZE)];
    const places = [place('MAZE-0001', ...start()), place('MAZE-0002', 3, 1)];
    expect(playingMazes(places, rows('MAZE-0002', everything().slice(0, 1)), ['MAZE-0001', 'MAZE-0002'], files, [])).toEqual(['MAZE-0002']);
  });

  it('a finished maze is not in play', () => {
    expect(playingMazes([place('MAZE-0001', 3, 1)], rows('MAZE-0001', everything()), ['MAZE-0001'], [opened(MAZE)], ['MAZE-0001'])).toEqual([]);
  });

  it('a maze whose file couldn\'t be opened is never in play, and the rest still are', () => {
    const places = [place('MAZE-0001', 3, 1), place('MAZE-0002', 3, 1)];
    expect(playingMazes(places, [], ['MAZE-0001', 'MAZE-0002'], [failed(), opened(MAZE)], [])).toEqual(['MAZE-0002']);
  });
});

describe('when each maze was last played', () => {
  const moved = (puzzle, at) => ({ puzzle, cell_row: 3, cell_col: 1, moved_at: at });
  const found = (puzzle, at) => ({ puzzle, cell_row: 0, cell_col: 1, found_at: at });

  it('the later of when the player last moved there and their latest find', () => {
    const places = [moved('MAZE-0001', '2026-10-05T08:00:00+00:00'), moved('MAZE-0002', '2026-10-01T08:00:00+00:00')];
    const finds = [found('MAZE-0001', '2026-10-02T08:00:00+00:00'), found('MAZE-0002', '2026-10-03T08:00:00+00:00'), found('MAZE-0002', '2026-10-02T08:00:00+00:00')];
    expect(mazeLastPlayed(places, finds)).toEqual(new Map([
      ['MAZE-0001', '2026-10-05T08:00:00+00:00'], ['MAZE-0002', '2026-10-03T08:00:00+00:00'],
    ]));
  });

  it('a maze with a place and no finds is played when the player last moved, and one with finds and no place when they last found', () => {
    expect(mazeLastPlayed([moved('MAZE-0001', '2026-10-05T08:00:00+00:00')], [found('MAZE-0002', '2026-10-03T08:00:00+00:00')])).toEqual(new Map([
      ['MAZE-0002', '2026-10-03T08:00:00+00:00'], ['MAZE-0001', '2026-10-05T08:00:00+00:00'],
    ]));
  });
});
