import { describe, it, expect } from 'vitest';
import { doneBoards, playingBoards } from '../../../core/minesweeper/done-core.js';
// core/minesweeper/done-core.js: a board's row says itself whether it's finished.

const row = (puzzle, mines, noMines, finished = false) => ({ puzzle, mines, no_mines: noMines, finished, tapped_at: '2026-10-12T00:00:00+00:00' });
const tile = (...ids) => ({ ids });

describe('finished boards', () => {
  it('are the boards the tiles stand for whose row says finished', () => {
    const rows = [row('MINE-0001', [[0, 3]], [], true), row('MINE-0002', [[0, 0]], [[0, 1]]), row('MINE-0003', [[1, 1]], [], true)];
    expect(doneBoards(rows, [tile('MINE-0001'), tile('MINE-0002')])).toEqual(['MINE-0001']);
  });

  it('a row with no finished, or anything but true, is not finished', () => {
    expect(doneBoards([{ puzzle: 'MINE-0001', mines: [], no_mines: [] }, { ...row('MINE-0002', [], []), finished: 'true' }], [tile('MINE-0001', 'MINE-0002')])).toEqual([]);
  });

  it('a collection\'s tile stands for each of its boards', () => {
    expect(doneBoards([row('MINE-0002', [[0, 0]], [], true)], [tile('MINE-0001', 'MINE-0002')])).toEqual(['MINE-0002']);
  });

  it('no rows, none finished', () => {
    expect(doneBoards([], [tile('MINE-0001')])).toEqual([]);
  });
});

describe('boards in play', () => {
  it('are the boards the tiles stand for with a square marked — a mine or a dot — and not finished', () => {
    const rows = [row('MINE-0001', [[0, 3]], []), row('MINE-0002', [], [[0, 1]]), row('MINE-0003', [[1, 1]], [], true), row('MINE-0004', [[1, 1]], [])];
    expect(playingBoards(rows, [tile('MINE-0001'), tile('MINE-0002'), tile('MINE-0003')], ['MINE-0003'])).toEqual(['MINE-0001', 'MINE-0002']);
  });

  it('a board whose every mark was cleared is not in play', () => {
    expect(playingBoards([row('MINE-0001', [], [])], [tile('MINE-0001')], [])).toEqual([]);
  });
});
