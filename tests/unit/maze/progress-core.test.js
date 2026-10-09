import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { mazeBoard, newMazePlay, tapMaze, padMaze } from '../../../core/maze/play-core.js';
import {
  cellRow, moveRows, restoredMaze, syncRows, joinedMaze, newPlace, placeMoved, placeDue, placeSending, placeSettled, keptPlace
} from '../../../core/maze/progress-core.js';
const require = createRequire(import.meta.url);
// core/maze/progress-core.js, against the fixture with every element: a guide, two collectibles,
// Key 1 and its zone, A, B and C, and six exits, the right one CBA on the end.
const MAZE = require('../../fixtures/MAZE-0001.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let BOARD;
beforeEach(() => {
  BOARD = mazeBoard(structuredClone(MAZE));
});

const row = (r, c) => ({ puzzle: 'MAZE-0001', cell_row: r, cell_col: c });
const presses = (list, play) => list.reduce((p, press) => padMaze(p, press, BOARD), play || newMazePlay(BOARD));
const taps = (cells, play) => cells.reduce((p, cell) => tapMaze(p, cell, BOARD), play || newMazePlay(BOARD));

describe('what a move saves', () => {
  it('a row is the maze\'s hidden ID and a cell', () => {
    expect(cellRow('MAZE-0042', [3, 7])).toEqual({ puzzle: 'MAZE-0042', cell_row: 3, cell_col: 7 });
  });

  it('a run saves where the trail stopped', () => {
    const before = newMazePlay(BOARD);
    expect(moveRows('MAZE-0001', before, presses(['S'], before), BOARD)).toEqual({ place: [row(2, 0)], found: [] });
  });

  it('a run that stops on something saves it found, as well as the place', () => {
    const before = presses(['S', 'S']);
    expect(moveRows('MAZE-0001', before, presses(['E'], before), BOARD)).toEqual({ place: [row(3, 1)], found: [row(3, 1)] });
  });

  it('a tap saves the cell tapped to, and what stands on it', () => {
    const before = taps([[1, 0], [2, 0], [3, 0], [4, 0]]);
    expect(moveRows('MAZE-0001', before, taps([[4, 1]], before), BOARD)).toEqual({ place: [row(4, 1)], found: [row(4, 1)] });
  });

  it('Back saves where it went back to, and nothing found again', () => {
    const before = presses(['S', 'S', 'E']);
    expect(moveRows('MAZE-0001', before, presses(['back'], before), BOARD)).toEqual({ place: [row(3, 0)], found: [] });
  });

  it('a move that goes nowhere — a wall, or a locked zone — saves nothing', () => {
    const before = newMazePlay(BOARD);
    expect(moveRows('MAZE-0001', before, presses(['N'], before), BOARD)).toEqual({ place: [], found: [] });
    const atZone = taps([[0, 1], [0, 2]]);
    expect(moveRows('MAZE-0001', atZone, taps([[1, 2]], atZone), BOARD)).toEqual({ place: [], found: [] });
  });

  it('a move along the same row or column still saves its place', () => {
    const before = taps([[0, 1]]);
    expect(moveRows('MAZE-0001', before, taps([[0, 2]], before), BOARD).place).toEqual([row(0, 2)]);
    const down = taps([[1, 0]]);
    expect(moveRows('MAZE-0001', down, taps([[2, 0]], down), BOARD).place).toEqual([row(2, 0)]);
  });
});

describe('a saved maze, from its rows', () => {
  it('comes back where the player was, with what they found', () => {
    const back = restoredMaze(BOARD, [row(3, 1)], [row(0, 3), row(3, 1)]);
    expect(back.trail).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]]);
    expect(back.got).toEqual(['letter-B', 'letter-C']);
  });

  it('with no place saved — or nothing at all — comes back at the start', () => {
    expect(restoredMaze(BOARD, [], [row(0, 3)])).toMatchObject({ trail: [[0, 0]], got: ['letter-C'] });
    expect(restoredMaze(BOARD, [], [])).toEqual(newMazePlay(BOARD));
  });
});

describe('signing in mid-maze', () => {
  const saved = () => restoredMaze(BOARD, [row(0, 5)], [row(4, 1)]);

  it('a player who hasn\'t stirred from the start saves nothing, and picks up the maze where they left it', () => {
    const fresh = newMazePlay(BOARD);
    expect(syncRows('MAZE-0001', fresh, BOARD)).toEqual({ place: [], found: [] });
    expect(joinedMaze(fresh, saved())).toEqual(saved());
  });

  it('one who has moved keeps their place, saves it and everything they\'ve found, and the saved finds join theirs', () => {
    const here = presses(['S', 'S', 'E']);
    expect(syncRows('MAZE-0001', here, BOARD)).toEqual({ place: [row(3, 1)], found: [row(3, 1)] });
    expect(joinedMaze(here, saved())).toEqual({
      trail: here.trail, got: ['letter-B', 'guide-0', 'collectible-1', 'letter-C', 'exit-ACB'], events: [], locked: [], runs: here.runs
    });
  });

  it('one who has moved without finding anything keeps their place, and saves it', () => {
    const walked = presses(['S']);
    expect(syncRows('MAZE-0001', walked, BOARD)).toEqual({ place: [row(2, 0)], found: [] });
    expect(joinedMaze(walked, saved()).trail).toEqual(walked.trail);
  });

  it('one back at the start with something found has stirred too, and keeps their own', () => {
    const back = taps([[0, 1], [0, 2], [0, 3], [0, 0]]);
    expect(syncRows('MAZE-0001', back, BOARD)).toEqual({ place: [row(0, 0)], found: [row(0, 3)] });
    expect(joinedMaze(back, saved()).trail).toEqual([[0, 0]]);
  });

  it('a find made on both sides counts once, and the join sets nothing off', () => {
    const both = presses(['S', 'S', 'E']);
    const joined = joinedMaze(both, restoredMaze(BOARD, [], [row(3, 1)]));
    expect(joined.got).toEqual(['letter-B']);
    expect(joined.events).toEqual([]);
  });
});

describe('the place waiting to be saved', () => {
  it('is none to begin with, and nothing is due', () => {
    expect(newPlace()).toEqual({ row: null, failed: 0, sending: false });
    expect(placeDue(newPlace())).toEqual([]);
  });

  it('a move makes its place due; once sent, nothing more is due until its answer comes', () => {
    const moved = placeMoved(newPlace(), row(2, 0));
    expect(placeDue(moved)).toEqual([row(2, 0)]);
    expect(placeSending(moved)).toEqual({ row: row(2, 0), failed: 0, sending: true });
    expect(placeDue(placeSending(moved))).toEqual([]);
  });

  it('a newer place takes the waiting one\'s place, keeping its failures and whether one is on its way', () => {
    expect(placeMoved({ row: row(2, 0), failed: 2, sending: true }, row(3, 0))).toEqual({ row: row(3, 0), failed: 2, sending: true });
  });

  // A place is the row the move made: the answer that comes back is for that one row.
  it('saved, the place leaves', () => {
    const sent = row(2, 0);
    expect(placeSettled({ row: sent, failed: 1, sending: true }, sent, true)).toEqual(newPlace());
  });

  it('saved while a newer place waited — even one on the same cell — the newer one is due', () => {
    const settled = placeSettled({ row: row(3, 0), failed: 1, sending: true }, row(2, 0), true);
    expect(settled).toEqual({ row: row(3, 0), failed: 0, sending: false });
    expect(placeDue(settled)).toEqual([row(3, 0)]);
    expect(placeSettled({ row: row(2, 0), failed: 0, sending: true }, row(2, 0), true).row).toEqual(row(2, 0));
  });

  it('failed, the place stays, a failure more, due again', () => {
    const sent = row(2, 0);
    const settled = placeSettled({ row: sent, failed: 1, sending: true }, sent, false);
    expect(settled).toEqual({ row: sent, failed: 2, sending: false });
    expect(placeDue(settled)).toEqual([sent]);
  });

  it('signing out forgets it; a renewed sign-in keeps it', () => {
    const waiting = { row: row(2, 0), failed: 2, sending: false };
    expect(keptPlace(false, waiting)).toEqual(newPlace());
    expect(keptPlace(true, waiting)).toBe(waiting);
  });
});
