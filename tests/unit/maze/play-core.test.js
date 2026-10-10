import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import {
  mazeUrl, mazeFile, resumedMaze, foundCells,
  wallPath, mazeBoard, newMazePlay, trailEnd, tapMaze, padMaze, padState, padKey, trailDraw, keyCall, checklist,
  mazeFinished, checklistCount, trailPoints, stopMarks, zoneMarks, solutionMarks, windowDetours, mazeFrame, centreOn,
  openView, refitView, zoomView, zoomFactor, pinchFactor, wheelFactor, zoomState, worldTransform, viewWindow, windowHolds,
  windowCells, windowMarks, minimapSize, minimapFit, minimapPens, minimapBox, minimapStops, minimapTrail, dragView
} from '../../../core/maze/play-core.js';
const require = createRequire(import.meta.url);
// core/maze/play-core.js, against the fixture with every element: a guide, two collectibles, Key 1
// and its zone, A, B and C, and six exits, the right one CBA on the end.
const MAZE = require('../../fixtures/MAZE-0001.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let BOARD;
beforeEach(() => {
  BOARD = mazeBoard(structuredClone(MAZE));
});

function taps(cells, play) {
  return cells.reduce((p, cell) => tapMaze(p, cell, BOARD), play || newMazePlay(BOARD));
}

// The saved walk, tapped a cell at a time — a step back the way it came taps the cell behind.
function walkSolution() {
  const step = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  const cells = MAZE.solution.split('').reduce((walk, side) => {
    const here = walk[walk.length - 1];
    return walk.concat([[here[0] + step[side][0], here[1] + step[side][1]]]);
  }, [[0, 0]]);
  return taps(cells.slice(1));
}

// From the solution's end, back to the start and round the right-hand exits: ACB, CAB, BAC, then
// ABC, then back up to BCA last.
const OTHER_EXITS = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [3, 5], [4, 5], [4, 4], [3, 4]];

describe('finding the maze a play URL names', () => {
  it("opens the file named by the query's hidden ID", () => {
    expect(mazeUrl('?id=MAZE-0001')).toBe('../content/puzzles/maze/MAZE-0001.json');
    expect(mazeUrl('?id=MAZE-12345')).toBe('../content/puzzles/maze/MAZE-12345.json');
  });

  it('finds no maze for a missing ID, or anything that is not a maze hidden ID', () => {
    ['', '?id=', '?id=1', '?id=MAZE-001', '?id=WSCH-0001', '?id=maze-0001', '?id=xMAZE-0001',
      '?id=MAZE-0001x', '?id=../MAZE-0001'].forEach(search => {
      expect(() => mazeUrl(search)).toThrow('No such puzzle');
    });
  });

  it('a maze\'s file, by its hidden ID', () => {
    expect(mazeFile('MAZE-0042')).toBe('../content/puzzles/maze/MAZE-0042.json');
  });
});

describe('coming back to a saved maze', () => {
  const presses = (list, play) => list.reduce((p, press) => padMaze(p, press, BOARD), play || newMazePlay(BOARD));
  const resumed = play => resumedMaze(BOARD, trailEnd(play), foundCells(play, BOARD));

  it('comes back exactly as the pad left it: the trail, where Back goes, and the ticks', () => {
    const left = presses(['S', 'S', 'E']);
    expect(left.trail).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]]);
    expect(resumed(left)).toEqual({ trail: left.trail, got: ['letter-B'], events: [], locked: [], runs: [1, 3, 4, 5] });
  });

  it('the trail is the one route to the player\'s cell, whatever branches were tried and backed out of', () => {
    const wandered = taps([[0, 1], [0, 2], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]]);
    expect(wandered.trail).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]]);
    expect(resumed(wandered).trail).toEqual(wandered.trail);
  });

  it('things found down a branch backed out of stay ticked; those on the trail are ticked found or not', () => {
    const back = resumedMaze(BOARD, [4, 1], [[0, 3]]);
    expect(back.got).toEqual(['guide-0', 'letter-C']);
    expect(back.trail).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1]]);
  });

  it('Back goes back a run at a time: to each junction, dead end or thing on the checklist the trail passed', () => {
    const far = resumedMaze(BOARD, [5, 5], []);
    expect(far.trail).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [5, 3], [5, 4], [5, 5]]);
    expect(far.runs).toEqual([1, 3, 4, 5, 6, 7, 11]);
    expect(padMaze(far, 'back', BOARD).trail).toEqual(far.trail.slice(0, 7));
  });

  it('the start comes back as the start alone, one run', () => {
    expect(resumedMaze(BOARD, [0, 0], [])).toEqual(newMazePlay(BOARD));
  });

  it('a cell no route reaches — inside a block, or off the maze — comes back at the start, the finds still ticked', () => {
    [[2, 2], [9, 9], [-1, 0]].forEach(cell => {
      expect(resumedMaze(BOARD, cell, [[0, 5]])).toEqual({ trail: [[0, 0]], got: ['collectible-1'], events: [], locked: [], runs: [1] });
    });
  });

  it('never steps off the maze, even where its edge is open', () => {
    const open = { rows: 1, cols: 2, start: [0, 0], bits: [[5, 7]], stops: [] };
    expect(resumedMaze(open, [0, 1], []).trail).toEqual([[0, 0], [0, 1]]);
    expect(resumedMaze(open, [0, -1], []).trail).toEqual([[0, 0]]);
    const wide = { rows: 1, cols: 1, start: [0, 0], bits: [[0]], stops: [] };
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(cell => {
      expect(resumedMaze(wide, cell, []).trail).toEqual([[0, 0]]);
    });
  });

  it('a big maze\'s trail comes back whole: every step to the next open cell, from the start to the player', () => {
    const hundred = mazeBoard(structuredClone(require('../../fixtures/MAZE-0003.json')));
    const trail = resumedMaze(hundred, [50, 50], []).trail;
    expect([trail.length, trail[0], trail[trail.length - 1]]).toEqual([167, [0, 0], [50, 50]]);
    trail.slice(1).forEach((cell, i) => {
      expect(Math.abs(cell[0] - trail[i][0]) + Math.abs(cell[1] - trail[i][1])).toBe(1);
      expect(tapMaze({ ...newMazePlay(hundred), trail: trail.slice(0, i + 1) }, cell, hundred).trail).toHaveLength(i + 2);
    });
  });

  it('tells apart two cells whose row and column run together the same — 1,10 and 11,0 — each coming back by its own route', () => {
    const open = { rows: 12, cols: 11, start: [0, 0], bits: Array.from({ length: 12 }, () => Array(11).fill(0)), stops: [] };
    [[1, 10], [11, 0]].forEach(cell => {
      const trail = resumedMaze(open, cell, []).trail;
      expect([trail.length, trail[0], trail[trail.length - 1]]).toEqual([12, [0, 0], cell]);
      trail.slice(1).forEach((step, i) => expect(Math.abs(step[0] - trail[i][0]) + Math.abs(step[1] - trail[i][1])).toBe(1));
    });
  });

  it('a found cell with nothing on it ticks nothing', () => {
    expect(resumedMaze(BOARD, [0, 0], [[1, 1], [4, 4]]).got).toEqual([]);
  });

  it('what\'s found is saved as its cells, in the checklist\'s order', () => {
    expect(foundCells({ got: ['exit-CBA', 'key-1', 'guide-0'] }, BOARD)).toEqual([[4, 1], [2, 1], [5, 5]]);
    expect(foundCells(newMazePlay(BOARD), BOARD)).toEqual([]);
  });
});

describe('the walls', () => {
  const whole = (rows, cols) => ({ top: 0, left: 0, bottom: rows - 1, right: cols - 1 });

  it('draws each cell\'s north and west walls, and the edge along the bottom row and right column', () => {
    expect(wallPath([[15], [15]], whole(2, 1))).toBe('M0 0h1M0 0v1M1 0v1' + 'M0 1h1M0 1v1M0 2h1M1 1v1');
    expect(wallPath([[15, 15]], whole(1, 2))).toBe('M0 0h1M0 0v1M0 1h1' + 'M1 0h1M1 0v1M1 1h1M2 0v1');
  });

  it('draws no wall a cell leaves open', () => {
    expect(wallPath([[0]], whole(1, 1))).toBe('');
    expect(wallPath([[2], [4]], whole(2, 1))).toBe('M1 0v1M0 2h1');
  });

  it('draws only the cells in a window, each where it stands in the maze, the edge only at the maze\'s edge', () => {
    const bits = [[15, 15, 15], [15, 15, 15], [15, 15, 15]];
    expect(wallPath(bits, { top: 1, left: 1, bottom: 1, right: 1 })).toBe('M1 1h1M1 1v1');
    expect(wallPath(bits, { top: 2, left: 2, bottom: 2, right: 2 })).toBe('M2 2h1M2 2v1M2 3h1M3 2v1');
    expect(wallPath(bits, { top: 0, left: 1, bottom: 0, right: 2 })).toBe('M1 0h1M1 0v1' + 'M2 0h1M2 0v1M3 0v1');
    expect(wallPath(bits, { top: 1, left: 0, bottom: 2, right: 0 })).toBe('M0 1h1M0 1v1' + 'M0 2h1M0 2v1M0 3h1');
  });
});

describe('the board', () => {
  it('carries the title, the date as players read it, and the type as its band', () => {
    expect(BOARD.title).toBe('Everything corner');
    expect(BOARD.created).toBe('8 Oct 2026');
    expect(BOARD.label).toBe('Keylecticodes');
    expect(BOARD.solutionLabel).toBe('Keylecticodes · Solution');
  });

  it('is the maze\'s size, its walls read per cell, its blocks and its start', () => {
    expect([BOARD.cols, BOARD.rows]).toEqual([6, 6]);
    expect(BOARD.bits[0]).toEqual([9, 5, 1, 5, 3, 11]);
    expect(BOARD.bits[5]).toEqual([14, 13, 6, 12, 5, 7]);
    expect(BOARD.walls).toBe(wallPath(BOARD.bits, { top: 0, left: 0, bottom: 5, right: 5 }));
    expect(BOARD.walls.startsWith('M0 0h1M0 0v1M1 0h1')).toBe(true);
    expect(BOARD.walls.endsWith('M5 6h1M6 5v1')).toBe(true);
    expect(BOARD.blocks).toEqual([[2, 2]]);
    expect(BOARD.start).toEqual([0, 0]);
    expect(BOARD.zones).toEqual([{ key: 1, top: 1, left: 2, bottom: 1, right: 3 }]);
  });

  it('lists every stop: guides, collectibles, keys, letters, then the exits in the checklist\'s order, the end\'s one right', () => {
    expect(BOARD.stops).toEqual([
      { id: 'guide-0', kind: 'guide', cell: [4, 1], label: '' },
      { id: 'collectible-0', kind: 'collectible', cell: [1, 3], label: '' },
      { id: 'collectible-1', kind: 'collectible', cell: [0, 5], label: '' },
      { id: 'key-1', kind: 'key', cell: [2, 1], label: '1' },
      { id: 'letter-A', kind: 'letter', cell: [5, 1], label: 'A' },
      { id: 'letter-B', kind: 'letter', cell: [3, 1], label: 'B' },
      { id: 'letter-C', kind: 'letter', cell: [0, 3], label: 'C' },
      { id: 'exit-ABC', kind: 'exit', cell: [3, 4], label: 'ABC', right: false },
      { id: 'exit-ACB', kind: 'exit', cell: [1, 5], label: 'ACB', right: false },
      { id: 'exit-BAC', kind: 'exit', cell: [3, 5], label: 'BAC', right: false },
      { id: 'exit-BCA', kind: 'exit', cell: [2, 4], label: 'BCA', right: false },
      { id: 'exit-CAB', kind: 'exit', cell: [2, 5], label: 'CAB', right: false },
      { id: 'exit-CBA', kind: 'exit', cell: [5, 5], label: 'CBA', right: true },
    ]);
  });

  it('lists the exits ABC to CBA whatever order the file has them in, and leaves the file as it was', () => {
    const puzzle = { ...structuredClone(MAZE), exits: structuredClone(MAZE.exits).reverse() };
    const before = structuredClone(puzzle.exits);
    expect(mazeBoard(puzzle).stops.filter(s => s.kind === 'exit').map(s => s.label)).toEqual(['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA']);
    expect(puzzle.exits).toEqual(before);
  });

  it('gives a maze without letters its end as the last stop, in place of exits', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), letters: [], exits: [] });
    expect(board.stops.at(-1)).toEqual({ id: 'end', kind: 'end', cell: [5, 5], label: 'End', right: true });
    expect(board.stops.filter(s => s.kind === 'exit')).toEqual([]);
  });

  it('reads the main path off the saved walk: the one route from the start to the end', () => {
    expect(BOARD.main).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [5, 3], [5, 4], [5, 5]]);
  });

  it('keeps every step of the walk that leaves the main path as a detour, and none along it', () => {
    const onMain = cell => BOARD.main.some(m => m[0] === cell[0] && m[1] === cell[1]);
    expect(BOARD.detours).toHaveLength(26);
    expect(BOARD.detours.every(([a, b]) => !onMain(a) || !onMain(b))).toBe(true);
    expect(BOARD.detours[0]).toEqual([[2, 0], [2, 1]]);
    expect(BOARD.detours[1]).toEqual([[2, 1], [2, 0]]);
    expect(BOARD.detours.at(-1)).toEqual([[5, 2], [4, 2]]);
  });

  it('a walk with no steps back has the whole walk as its main path and no detours', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), solution: 'SSSSEEESEE' });
    expect(board.main).toHaveLength(11);
    expect(board.detours).toEqual([]);
  });
});

describe('tapping a trail', () => {
  it('starts at the start, holding nothing, the start its only move\'s end', () => {
    expect(newMazePlay(BOARD)).toEqual({ trail: [[0, 0]], got: [], events: [], locked: [], runs: [1] });
    expect(trailEnd(newMazePlay(BOARD))).toEqual([0, 0]);
    expect(trailEnd(taps([[0, 1], [0, 2]]))).toEqual([0, 2]);
  });

  it('ends a move at each step a tap takes, and none at a tap that goes nowhere', () => {
    expect(taps([[0, 1], [0, 2]]).runs).toEqual([1, 2, 3]);
    expect(taps([[0, 1], [5, 5]]).runs).toEqual([1, 2]);
    expect(taps([[0, 1], [0, 2], [1, 2]]).runs).toEqual([1, 2, 3]);
  });

  it('backing out to an earlier cell drops the moves past it, and ends one there', () => {
    const play = taps([[0, 1], [0, 2], [0, 3], [0, 4]]);
    expect(tapMaze(play, [0, 2], BOARD).runs).toEqual([1, 2, 3]);
    expect(tapMaze(play, [0, 0], BOARD).runs).toEqual([1]);
    const ran = padMaze(newMazePlay(BOARD), 'E', BOARD);
    expect(ran.runs).toEqual([1, 3]);
    expect(tapMaze(ran, [0, 1], BOARD).runs).toEqual([1, 2]);
    expect(tapMaze(ran, [0, 2], BOARD).runs).toEqual([1, 3]);
  });

  it('goes on to an open cell beside the trail\'s end, each way', () => {
    expect(taps([[0, 1]]).trail).toEqual([[0, 0], [0, 1]]);
    expect(taps([[1, 0]]).trail).toEqual([[0, 0], [1, 0]]);
    expect(taps([[0, 1], [0, 2], [1, 2], [1, 3]], taps([[1, 0], [2, 0], [2, 1], [2, 0], [1, 0], [0, 0]])).trail.slice(-2)).toEqual([[1, 2], [1, 3]]);
    expect(taps([[1, 0], [2, 0], [2, 1], [1, 1]]).trail.at(-1)).toEqual([1, 1]);
    expect(taps([[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5]]).trail.at(-1)).toEqual([1, 5]);
    expect(taps([[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [0, 5]]).trail.at(-1)).toEqual([0, 5]);
    expect(tapMaze({ trail: [[1, 5]], got: [], events: [], locked: [], runs: [1] }, [1, 4], BOARD).trail).toEqual([[1, 5], [1, 4]]);
  });

  it('does nothing for a cell through a wall, one not beside the trail\'s end, or one corner to corner', () => {
    const one = taps([[0, 1]]);
    [[1, 1], [0, 3], [1, 2], [1, 0], [5, 5]].forEach(cell => {
      expect(tapMaze(one, cell, BOARD)).toEqual({ trail: one.trail, got: [], events: [], locked: [], runs: [1, 2] });
    });
  });

  it('never walks into a block', () => {
    const play = taps([[0, 1], [0, 2], [1, 2]], taps([[1, 0], [2, 0], [2, 1], [2, 0], [1, 0], [0, 0]]));
    expect(tapMaze(play, [2, 2], BOARD).trail).toEqual(play.trail);
  });

  it('backs out to an earlier cell of the trail, keeping every tick', () => {
    const play = taps([[0, 1], [0, 2], [0, 3], [0, 4]]);
    const back = tapMaze(play, [0, 1], BOARD);
    expect(back.trail).toEqual([[0, 0], [0, 1]]);
    expect(back.got).toEqual(['letter-C']);
    expect(tapMaze(play, [0, 0], BOARD).trail).toEqual([[0, 0]]);
  });

  it('a tap on the trail\'s own end changes nothing', () => {
    const play = taps([[0, 1]]);
    expect(tapMaze(play, [0, 1], BOARD).trail).toEqual(play.trail);
  });

  it('picks up what it steps on, once', () => {
    const play = taps([[0, 1], [0, 2], [0, 3], [0, 2], [0, 3]]);
    expect(play.got).toEqual(['letter-C']);
    expect(taps([[1, 0], [2, 0], [2, 1]]).got).toEqual(['key-1']);
  });

  it('refuses a cell in a zone without its key, naming the key, and lets the player in once they hold it', () => {
    const before = taps([[0, 1], [0, 2]]);
    const refused = tapMaze(before, [1, 2], BOARD);
    expect(refused).toEqual({ trail: before.trail, got: before.got, events: ['locked'], locked: [1], runs: [1, 2, 3] });
    const keyed = taps([[1, 0], [2, 0], [2, 1], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2]]);
    expect(keyed.trail.at(-1)).toEqual([1, 2]);
    expect(keyed.events).toEqual([]);
    expect(keyed.locked).toEqual([]);
  });

  it('a cell just below a zone, in its columns, is not locked', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), zones: [{ key: 1, top: 0, left: 0, bottom: 0, right: 0 }] });
    expect(tapMaze(newMazePlay(board), [1, 0], board)).toEqual({ trail: [[0, 0], [1, 0]], got: [], events: [], locked: [], runs: [1, 2] });
  });

  it('a cell in two zones needs both keys', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), zones: [...MAZE.zones, { key: 2, top: 0, left: 1, bottom: 1, right: 2 }] });
    const play = [[1, 0], [2, 0], [2, 1], [2, 0], [1, 0], [0, 0], [0, 1]].reduce((p, c) => tapMaze(p, c, board), newMazePlay(board));
    expect(play.locked).toEqual([2]);
    const inside = { ...play, trail: [[0, 0], [0, 1], [0, 2]], got: [] };
    expect(tapMaze(inside, [1, 2], board).locked).toEqual([1, 2]);
  });

  it('a step after a refused one forgets the refusal', () => {
    const refused = tapMaze(taps([[0, 1], [0, 2]]), [1, 2], BOARD);
    expect(tapMaze(refused, [0, 3], BOARD)).toMatchObject({ events: [], locked: [] });
    expect(tapMaze(refused, [0, 1], BOARD)).toMatchObject({ events: [], locked: [] });
    expect(tapMaze(refused, [5, 5], BOARD)).toMatchObject({ events: [], locked: [] });
  });

  it('the saved walk picks up everything, crosses the exit it passes, and reaches the right one, but leaves four exits to find', () => {
    const play = walkSolution();
    expect(play.trail).toEqual(BOARD.main);
    expect(play.got).toEqual(['key-1', 'letter-C', 'exit-ACB', 'collectible-1', 'collectible-0', 'letter-B', 'guide-0', 'letter-A', 'exit-CBA']);
    expect(mazeFinished(play, BOARD)).toBe(false);
  });

  it('completes on the tap that ticks the last line, and never again', () => {
    const almost = taps(OTHER_EXITS, walkSolution());
    expect(almost.events).toEqual([]);
    expect(mazeFinished(almost, BOARD)).toBe(false);
    const done = taps([[4, 4], [4, 5], [3, 5], [2, 5], [1, 5], [1, 4], [2, 4]], almost);
    expect(done.events).toEqual(['complete']);
    expect(mazeFinished(done, BOARD)).toBe(true);
    const again = taps([[1, 4], [2, 4]], done);
    expect(again.events).toEqual([]);
    expect(mazeFinished(again, BOARD)).toBe(true);
  });
});

describe('the checklist', () => {
  it('reads, untouched: Guides, Keys and Collectibles counted, then A, B, C, then the six exits', () => {
    expect(checklist(newMazePlay(BOARD), BOARD)).toEqual([
      { text: 'Guides', progress: '0/1', mark: '', done: false },
      { text: 'Keys', progress: '0/1', mark: '', done: false },
      { text: 'Collectibles', progress: '0/2', mark: '', done: false },
      ...['A', 'B', 'C', 'ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'].map(text => ({ text, progress: '', mark: '', done: false })),
    ]);
    expect(checklistCount(newMazePlay(BOARD), BOARD)).toBe('0/12');
  });

  it('ticks a letter, in any order, with no mark', () => {
    const lines = checklist(taps([[0, 1], [0, 2], [0, 3]]), BOARD);
    expect(lines[5]).toEqual({ text: 'C', progress: '', mark: '', done: true });
    expect(lines[3].done).toBe(false);
  });

  it('counts a group up as its stops are picked up, done once all are', () => {
    const one = taps([[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [0, 5]]);
    expect(checklist(one, BOARD)[2]).toEqual({ text: 'Collectibles', progress: '1/2', mark: '', done: false });
    const play = walkSolution();
    expect(checklist(play, BOARD).slice(0, 3).map(l => [l.progress, l.done])).toEqual([['1/1', true], ['1/1', true], ['2/2', true]]);
  });

  it('marks the right exit ✓ and a wrong one ✗, each ticked', () => {
    const lines = checklist(taps(OTHER_EXITS.slice(0, 7), walkSolution()), BOARD);
    expect(lines.find(l => l.text === 'CBA')).toEqual({ text: 'CBA', progress: '', mark: '✓', done: true });
    expect(lines.find(l => l.text === 'ACB')).toEqual({ text: 'ACB', progress: '', mark: '✗', done: true });
    expect(lines.find(l => l.text === 'BCA')).toEqual({ text: 'BCA', progress: '', mark: '', done: false });
    expect(checklistCount(taps(OTHER_EXITS.slice(0, 7), walkSolution()), BOARD)).toBe('8/12');
  });

  it('a maze without letters lists only what it has, ending in End', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), guides: [], keys: [], zones: [], letters: [], exits: [] });
    expect(checklist(newMazePlay(board), board)).toEqual([
      { text: 'Collectibles', progress: '0/2', mark: '', done: false },
      { text: 'End', progress: '', mark: '', done: false },
    ]);
    const ended = { trail: [[5, 5]], got: ['collectible-0', 'collectible-1', 'end'], events: [], locked: [] };
    expect(checklist(ended, board)[1]).toEqual({ text: 'End', progress: '', mark: '✓', done: true });
    expect(mazeFinished(ended, board)).toBe(true);
  });
});

describe('what the board shows', () => {
  it('draws the trail through each cell\'s centre, x then y', () => {
    expect(trailPoints([[0, 0], [0, 1], [1, 1]])).toBe('0.5,0.5 1.5,0.5 1.5,1.5');
  });

  it('fades each stop picked up, and marks an exit stepped on', () => {
    const marks = stopMarks(taps(OTHER_EXITS.slice(0, 7), walkSolution()), BOARD);
    expect(marks.find(m => m.id === 'letter-A')).toEqual({ id: 'letter-A', got: true, mark: '' });
    expect(marks.find(m => m.id === 'exit-CBA')).toEqual({ id: 'exit-CBA', got: true, mark: '✓' });
    expect(marks.find(m => m.id === 'exit-ACB')).toEqual({ id: 'exit-ACB', got: true, mark: '✗' });
    expect(marks.find(m => m.id === 'exit-ABC')).toEqual({ id: 'exit-ABC', got: false, mark: '' });
  });

  it('marks the end ✓ in a maze without letters once reached', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), letters: [], exits: [] });
    expect(stopMarks({ got: ['end'] }, board).at(-1)).toEqual({ id: 'end', got: true, mark: '✓' });
    expect(stopMarks({ got: [] }, board).at(-1)).toEqual({ id: 'end', got: false, mark: '' });
  });

  it('opens a zone once its key is held', () => {
    expect(zoneMarks(newMazePlay(BOARD), BOARD)).toEqual([{ key: 1, open: false }]);
    expect(zoneMarks(taps([[1, 0], [2, 0], [2, 1]]), BOARD)).toEqual([{ key: 1, open: true }]);
  });

  it('draws the solution: the main path, and the exits, the right one apart', () => {
    const marks = solutionMarks(BOARD);
    expect(marks.main).toBe(trailPoints(BOARD.main));
    expect(marks.exits).toHaveLength(6);
    expect(marks.exits.filter(e => e.right)).toEqual([{ cell: [5, 5], right: true }]);
    expect(marks.exits[0]).toEqual({ cell: [3, 4], right: false });
  });

  it('a maze without letters has no exits to mark on its solution', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), letters: [], exits: [] });
    expect(solutionMarks(board).exits).toEqual([]);
  });

  it('draws each detour step with a cell in the window, and only those', () => {
    const all = windowDetours(BOARD, { top: 0, left: 0, bottom: 5, right: 5 });
    expect(all.startsWith('M0.5,2.5L1.5,2.5M1.5,2.5L0.5,2.5')).toBe(true);
    expect(all.match(/M/g)).toHaveLength(26);
    expect(windowDetours(BOARD, { top: 2, left: 0, bottom: 2, right: 0 })).toBe('M0.5,2.5L1.5,2.5M1.5,2.5L0.5,2.5');
    expect(windowDetours(BOARD, { top: 2, left: 1, bottom: 2, right: 1 })).toBe('M0.5,2.5L1.5,2.5M1.5,2.5L0.5,2.5');
    expect(windowDetours(BOARD, { top: 5, left: 0, bottom: 5, right: 0 })).toBe('');
  });
});

describe('the control pad', () => {
  const play = (trail, runs, got = []) => ({ trail, got, events: [], locked: [], runs });

  it('runs along a corridor and stops at the next junction', () => {
    const ran = padMaze(newMazePlay(BOARD), 'E', BOARD);
    expect(ran.trail).toEqual([[0, 0], [0, 1], [0, 2]]);
    expect(ran.runs).toEqual([1, 3]);
    expect(ran.events).toEqual([]);
    expect(padMaze(newMazePlay(BOARD), 'S', BOARD).trail).toEqual([[0, 0], [1, 0], [2, 0]]);
  });

  it('follows the corridor round its bends', () => {
    const ran = padMaze(play([[0, 0], [0, 1], [0, 2], [0, 3]], [1, 3, 4], ['letter-C']), 'E', BOARD);
    expect(ran.trail.slice(3)).toEqual([[0, 3], [0, 4], [1, 4]]);
    expect(ran.runs).toEqual([1, 3, 4, 6]);
  });

  it('runs left round a bend, never back the way it came', () => {
    const ran = padMaze(play([[0, 2]], [1]), 'W', BOARD);
    expect(ran.trail).toEqual([[0, 2], [0, 1], [0, 0], [1, 0], [2, 0]]);
  });

  it('stops at a dead end', () => {
    const ran = padMaze(play([[2, 0], [2, 1]], [1, 2]), 'N', BOARD);
    expect(ran.trail).toEqual([[2, 0], [2, 1], [1, 1]]);
  });

  it('stops on anything on the checklist, and picks it up', () => {
    const ran = padMaze(play([[0, 0], [0, 1], [0, 2]], [1, 3]), 'E', BOARD);
    expect(ran.trail.at(-1)).toEqual([0, 3]);
    expect(ran.got).toEqual(['letter-C']);
    const keyed = padMaze(play([[0, 0], [1, 0], [2, 0]], [1, 3]), 'E', BOARD);
    expect(keyed.trail.at(-1)).toEqual([2, 1]);
    expect(keyed.got).toEqual(['key-1']);
  });

  it('stops on a stop already picked up, too: it\'s still on the checklist', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), collectibles: [{ row: 0, col: 1 }, { row: 0, col: 5 }] });
    const ran = padMaze({ ...newMazePlay(board), got: ['collectible-0'] }, 'E', board);
    expect(ran.trail).toEqual([[0, 0], [0, 1]]);
  });

  it('a run that ticks the last line completes the maze', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), guides: [], collectibles: [], keys: [], zones: [], letters: [], exits: [] });
    const ran = padMaze(play([[5, 3]], [1]), 'E', board);
    expect(ran.trail).toEqual([[5, 3], [5, 4], [5, 5]]);
    expect(ran.events).toEqual(['complete']);
    expect(mazeFinished(ran, board)).toBe(true);
  });

  it('a zone whose key isn\'t held refuses the first step, naming the key; the trail doesn\'t move', () => {
    const at = play([[0, 0], [0, 1], [0, 2]], [1, 3]);
    expect(padMaze(at, 'S', BOARD)).toEqual({ trail: at.trail, got: [], events: ['locked'], locked: [1], runs: [1, 3] });
  });

  it('a run into a zone whose key isn\'t held stops at its edge', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), zones: [{ key: 1, top: 0, left: 2, bottom: 0, right: 2 }] });
    const ran = padMaze(newMazePlay(board), 'E', board);
    expect(ran).toEqual({ trail: [[0, 0], [0, 1]], got: [], events: ['locked'], locked: [1], runs: [1, 2] });
  });

  it('a way with a wall does nothing', () => {
    const start = newMazePlay(BOARD);
    expect(padMaze(start, 'N', BOARD)).toEqual(start);
    expect(padMaze(start, 'W', BOARD)).toEqual(start);
    const refused = { ...play([[0, 0], [0, 1], [0, 2]], [1, 3]), events: ['locked'], locked: [1] };
    expect(padMaze(refused, 'N', BOARD)).toEqual(play([[0, 0], [0, 1], [0, 2]], [1, 3]));
  });

  it('Back goes back one move, to where the move before ended, keeping every tick', () => {
    const one = padMaze(newMazePlay(BOARD), 'E', BOARD);
    const two = padMaze(one, 'E', BOARD);
    const back = padMaze(two, 'back', BOARD);
    expect(back).toEqual({ trail: one.trail, got: ['letter-C'], events: [], locked: [], runs: [1, 3] });
    expect(padMaze(back, 'back', BOARD)).toEqual({ trail: [[0, 0]], got: ['letter-C'], events: [], locked: [], runs: [1] });
  });

  it('pressing the way the trail came in by is Back too', () => {
    const two = padMaze(padMaze(newMazePlay(BOARD), 'E', BOARD), 'E', BOARD);
    expect(padMaze(two, 'W', BOARD)).toEqual(padMaze(two, 'back', BOARD));
    const down = padMaze(newMazePlay(BOARD), 'S', BOARD);
    expect(padMaze(down, 'N', BOARD).trail).toEqual([[0, 0]]);
  });

  it('only the cell just behind the player is the way back: a trail of one cell has none, and an earlier one beside it isn\'t it', () => {
    expect(padMaze(play([[1, 4]], [1]), 'N', BOARD).trail).toEqual([[1, 4], [0, 4], [0, 3]]);
    const looped = play([[1, 1], [2, 1], [2, 0], [1, 0]], [1, 2, 3, 4]);
    expect(padMaze(looped, 'E', BOARD)).toEqual(looped);
    expect(padMaze(looped, 'S', BOARD).trail).toEqual([[1, 1], [2, 1], [2, 0]]);
  });

  it('Back at the start, before any move, does nothing', () => {
    const start = { ...newMazePlay(BOARD), events: ['locked'], locked: [1] };
    expect(padMaze(start, 'back', BOARD)).toEqual(newMazePlay(BOARD));
  });

  it('Back after taps goes back a step a tap', () => {
    const tapped = taps([[0, 1], [0, 2]]);
    expect(padMaze(tapped, 'back', BOARD).trail).toEqual([[0, 0], [0, 1]]);
  });

  it('greys each way with a wall, and Back until there\'s a move to go back on', () => {
    expect(padState(newMazePlay(BOARD), BOARD)).toEqual({ back: false, N: false, E: true, S: true, W: false });
    const ran = padMaze(newMazePlay(BOARD), 'E', BOARD);
    expect(padState(ran, BOARD)).toEqual({ back: true, N: false, E: true, S: true, W: true });
    expect(padState(play([[1, 4]], [1]), BOARD)).toEqual({ back: false, N: true, E: true, S: true, W: false });
  });

  it('the arrow keys and Backspace press the pad; any other key, or one with a modifier, nothing', () => {
    const key = (k, held = {}) => padKey({ key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...held });
    expect(['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Backspace'].map(k => key(k))).toEqual(['N', 'E', 'S', 'W', 'back']);
    expect(key('a')).toBe('');
    expect(key('Enter')).toBe('');
    ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'].forEach(held => expect(key('ArrowUp', { [held]: true })).toBe(''));
  });

  it('draws a move\'s new steps on from where the trail ended, 40ms a step up to 300ms; a move back draws nothing', () => {
    const start = newMazePlay(BOARD), ran = padMaze(start, 'E', BOARD);
    expect(trailDraw(start, ran)).toEqual({ total: 2, from: 2, ms: 80 });
    expect(trailDraw(ran, start)).toEqual({ total: 0, from: 0, ms: 0 });
    expect(trailDraw(start, start)).toEqual({ total: 0, from: 0, ms: 0 });
    const long = { trail: Array.from({ length: 12 }, (_, i) => [0, i]) };
    expect(trailDraw({ trail: [[0, 0]] }, long)).toEqual({ total: 11, from: 11, ms: 300 });
    expect(trailDraw({ trail: long.trail.slice(0, 5) }, long)).toEqual({ total: 11, from: 7, ms: 280 });
  });

  it('calls a refused step\'s keys at the top-right corner of where the player stands', () => {
    expect(keyCall({ trail: [[0, 0], [0, 2]], locked: [1] })).toEqual({ x: 2.8, y: 0.28, text: '1' });
    expect(keyCall({ trail: [[4, 1]], locked: [1, 2] })).toEqual({ x: 1.8, y: 4.28, text: '1 2' });
  });
});

describe('the frame', () => {
  const room = { viewHeight: 900, chromeHeight: 100, width: 1000, chromeWidth: 40, rows: 40, cols: 32 };

  it('fits the window\'s height when that is the tighter, the frame the whole maze at that cell', () => {
    expect(mazeFrame(room)).toEqual({ fit: 20, width: 640, height: 800 });
    expect(mazeFrame({ ...room, viewHeight: 939 }).fit).toBe(20);
    expect(mazeFrame({ ...room, viewHeight: 940 }).fit).toBe(21);
  });

  it('fits the page\'s width when that is the tighter', () => {
    expect(mazeFrame({ ...room, width: 40 + 32 * 12 }).fit).toBe(12);
    expect(mazeFrame({ ...room, width: 39 + 32 * 12 }).fit).toBe(11);
  });

  it('a cell is a whole pixel down to 10px; under that, every bit of room counts', () => {
    expect(mazeFrame({ ...room, viewHeight: 100 + 40 * 10.5 }).fit).toBe(10);
    expect(mazeFrame({ ...room, viewHeight: 100 + 40 * 10 }).fit).toBe(10);
    expect(mazeFrame({ ...room, viewHeight: 100 + 40 * 9.5 })).toEqual({ fit: 9.5, width: 32 * 9.5, height: 40 * 9.5 });
    const hundred = { viewHeight: 950, chromeHeight: 100, width: 1000, chromeWidth: 40, rows: 100, cols: 100 };
    expect(mazeFrame(hundred)).toEqual({ fit: 8.5, width: 850, height: 850 });
  });
});

describe('the view', () => {
  const big = () => ({ rows: 100, cols: 100, start: [50, 50] });
  const frame = { fit: 8, width: 800, height: 800 };

  it('a maze opens whole when its cells can be tapped so', () => {
    expect(openView({ fit: 20, width: 640, height: 800 }, { rows: 40, cols: 32 }, [20, 16])).toEqual({ cell: 20, x: 0, y: 0 });
    expect(openView({ fit: 10, width: 1000, height: 1000 }, big(), [50, 50])).toEqual({ cell: 10, x: 0, y: 0 });
  });

  it('a maze too big for that opens zoomed in on the player, cells 20px across', () => {
    expect(openView(frame, big(), [50, 50])).toEqual({ cell: 20, x: 30.5, y: 30.5 });
    expect(openView(frame, big(), [50, 40])).toEqual({ cell: 20, x: 20.5, y: 30.5 });
    expect(openView({ fit: 9.9, width: 990, height: 990 }, big(), [50, 50]).cell).toBe(20);
  });

  it('keeps a cell in the frame\'s centre, as near as the maze\'s edges let it', () => {
    const view = { cell: 20, x: 0, y: 0 };
    expect(centreOn(view, [50, 40], frame, big())).toEqual({ cell: 20, x: 20.5, y: 30.5 });
    expect(centreOn(view, [0, 0], frame, big())).toEqual({ cell: 20, x: 0, y: 0 });
    expect(centreOn(view, [99, 99], frame, big())).toEqual({ cell: 20, x: 60, y: 60 });
    expect(centreOn(view, [99, 0], { fit: 8, width: 800, height: 400 }, big())).toEqual({ cell: 20, x: 0, y: 80 });
    expect(centreOn({ cell: 8, x: 3, y: 3 }, [99, 99], frame, big())).toEqual({ cell: 8, x: 0, y: 0 });
  });

  it('a resize keeps a player looking at the whole maze on the whole of it, the frame grown or shrunk', () => {
    expect(refitView({ cell: 8, x: 0, y: 0 }, frame, { fit: 9, width: 900, height: 900 }, big(), [50, 50])).toEqual({ cell: 9, x: 0, y: 0 });
    expect(refitView({ cell: 8, x: 0, y: 0 }, frame, { fit: 7, width: 700, height: 700 }, big(), [50, 50])).toEqual({ cell: 7, x: 0, y: 0 });
  });

  it('a resize keeps any other zoom as it was, as far as the new frame lets it, centred on the player', () => {
    expect(refitView({ cell: 20, x: 0, y: 0 }, frame, { fit: 9, width: 900, height: 900 }, big(), [50, 50])).toEqual({ cell: 20, x: 28, y: 28 });
    expect(refitView({ cell: 20, x: 0, y: 0 }, frame, { fit: 30, width: 3000, height: 3000 }, big(), [50, 50])).toEqual({ cell: 30, x: 0, y: 0 });
    expect(refitView({ cell: 48, x: 0, y: 0 }, frame, { fit: 9, width: 900, height: 900 }, big(), [0, 0]).cell).toBe(48);
  });

  it('zooms about the player, who stays where they are on screen', () => {
    const view = { cell: 20, x: 30, y: 30 };
    const zoomed = zoomView(view, 1.25, frame, big(), [50, 40]);
    expect(zoomed.cell).toBe(25);
    expect(zoomed.x).toBeCloseTo(32.1);
    expect(zoomed.y).toBeCloseTo(34.1);
    expect((40.5 - zoomed.x) * 25).toBeCloseTo((40.5 - 30) * 20);
    const corner = zoomView({ cell: 20, x: 0, y: 0 }, 1.25, frame, big(), [0, 0]);
    expect(corner.x).toBeCloseTo(0.1);
    expect(corner.y).toBeCloseTo(0.1);
    expect(zoomView(view, 1.25, frame, big(), [69, 69]).x).toBeCloseTo(69.5 - 39.5 * 0.8);
  });

  it('zooms about the middle of what\'s on view once the player is off it, from the whole maze to cells 48px across', () => {
    const view = { cell: 20, x: 30, y: 30 };
    expect(zoomView(view, 1.25, frame, big(), [0, 0])).toEqual({ cell: 25, x: 34, y: 34 });
    expect(zoomView(view, 1.25, frame, big(), [70, 50])).toEqual({ cell: 25, x: 34, y: 34 });
    expect(zoomView(view, 1.25, frame, big(), [50, 29])).toEqual({ cell: 25, x: 34, y: 34 });
    const most = zoomView(view, 10, frame, big(), [0, 0]);
    expect(most.cell).toBe(48);
    expect(most.x).toBeCloseTo(50 - 800 / 48 / 2);
    expect(zoomView(view, 0.1, frame, big(), [0, 0])).toEqual({ cell: 8, x: 0, y: 0 });
    expect(zoomView({ cell: 20, x: 60, y: 0 }, 0.8, frame, big(), [0, 0])).toEqual({ cell: 16, x: 50, y: 0 });
    expect(zoomView({ cell: 20, x: 40, y: 40 }, 0.8, frame, big(), [0, 0])).toEqual({ cell: 16, x: 35, y: 35 });
  });

  it('a maze whose whole fits bigger than 48px a cell doesn\'t zoom', () => {
    const small = { fit: 60, width: 360, height: 360 };
    expect(zoomView({ cell: 60, x: 0, y: 0 }, 1.25, small, { rows: 6, cols: 6 }, [0, 0])).toEqual({ cell: 60, x: 0, y: 0 });
    expect(zoomState({ cell: 60, x: 0, y: 0 }, small)).toEqual({ zoomIn: false, zoomOut: false, zoomable: false });
  });

  it('says what the zoom can do: in up to 48px, out down to the whole maze', () => {
    expect(zoomState({ cell: 20 }, frame)).toEqual({ zoomIn: true, zoomOut: true, zoomable: true });
    expect(zoomState({ cell: 48 }, frame)).toEqual({ zoomIn: false, zoomOut: true, zoomable: true });
    expect(zoomState({ cell: 8 }, frame)).toEqual({ zoomIn: true, zoomOut: false, zoomable: true });
    expect(zoomState({ cell: 48 }, { fit: 48 })).toEqual({ zoomIn: false, zoomOut: false, zoomable: false });
  });

  it('+ steps in a quarter, − back out', () => {
    expect(zoomFactor('in')).toBe(1.25);
    expect(zoomFactor('out')).toBe(0.8);
  });

  it('a pinch zooms by how far the fingers moved apart', () => {
    expect(pinchFactor([{ x: 0, y: 0 }, { x: 3, y: 4 }], [{ x: 0, y: 0 }, { x: 6, y: 8 }])).toBe(2);
    expect(pinchFactor([{ x: 10, y: 10 }, { x: 10, y: 20 }], [{ x: 10, y: 10 }, { x: 15, y: 10 }])).toBe(0.5);
    expect(pinchFactor([{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 0, y: 0 }, { x: 0, y: 3 }])).toBe(3);
  });

  it('a wheel turned up zooms in, down out', () => {
    expect(wheelFactor(0)).toBe(1);
    expect(wheelFactor(-100)).toBeCloseTo(Math.E);
    expect(wheelFactor(100)).toBeCloseTo(1 / Math.E);
  });

  it('moves the maze behind the frame so the view\'s top-left sits at the frame\'s', () => {
    expect(worldTransform({ cell: 20, x: 1.5, y: 2 })).toBe('translate(-30px, -40px)');
  });
});

describe('drawing only what\'s on screen', () => {
  const big = () => ({ rows: 100, cols: 100 });
  const frame = { fit: 8, width: 800, height: 800 };

  it('draws the cells on view and 8 more each way', () => {
    expect(viewWindow({ cell: 20, x: 30.5, y: 10 }, frame, big())).toEqual({ top: 2, left: 22, bottom: 57, right: 78 });
  });

  it('never past the maze\'s edges', () => {
    expect(viewWindow({ cell: 20, x: 0, y: 0 }, frame, big())).toEqual({ top: 0, left: 0, bottom: 47, right: 47 });
    expect(viewWindow({ cell: 20, x: 60, y: 60 }, frame, big())).toEqual({ top: 52, left: 52, bottom: 99, right: 99 });
    expect(viewWindow({ cell: 8, x: 0, y: 0 }, frame, big())).toEqual({ top: 0, left: 0, bottom: 99, right: 99 });
  });

  it('a window holds the view until a cell on view falls outside it, on any side', () => {
    const win = viewWindow({ cell: 20, x: 30, y: 30 }, frame, big());
    expect(win).toEqual({ top: 22, left: 22, bottom: 77, right: 77 });
    const at = (x, y) => windowHolds(win, { cell: 20, x, y }, frame, big());
    expect(at(30, 30)).toBe(true);
    expect([at(22, 30), at(38, 30), at(30, 22), at(30, 38)]).toEqual([true, true, true, true]);
    expect([at(21.9, 30), at(38.1, 30), at(30, 21.9), at(30, 38.1)]).toEqual([false, false, false, false]);
    expect(windowHolds({ top: 0, left: 0, bottom: -1, right: -1 }, { cell: 20, x: 0, y: 0 }, frame, big())).toBe(false);
  });

  it('lists the window\'s cells row by row, the start marked, each with the stop on it', () => {
    const cells = windowCells(BOARD, { top: 0, left: 4, bottom: 1, right: 5 });
    expect(cells.map(c => c.cell)).toEqual([[0, 4], [0, 5], [1, 4], [1, 5]]);
    expect(cells.map(c => c.start)).toEqual([false, false, false, false]);
    expect(cells.map(c => c.stops.map(s => s.id))).toEqual([[], ['collectible-1'], [], ['exit-ACB']]);
    const corner = windowCells(BOARD, { top: 0, left: 0, bottom: 0, right: 1 });
    expect(corner.map(c => c.start)).toEqual([true, false]);
    expect(windowCells(BOARD, { top: 0, left: 0, bottom: 5, right: 5 })).toHaveLength(36);
    expect(windowCells(BOARD, { top: 1, left: 4, bottom: 1, right: 5 }).map(c => c.cell)).toEqual([[1, 4], [1, 5]]);
  });

  it('keeps the blocks and zones over any of the window\'s cells', () => {
    const marks = win => windowMarks(BOARD, win);
    expect(marks({ top: 0, left: 0, bottom: 5, right: 5 })).toEqual({ blocks: [[2, 2]], zones: BOARD.zones });
    expect(marks({ top: 3, left: 3, bottom: 5, right: 5 }).blocks).toEqual([[2, 2]]);
    expect(marks({ top: 0, left: 0, bottom: 2, right: 2 }).blocks).toEqual([[2, 2]]);
    expect(marks({ top: 4, left: 0, bottom: 5, right: 5 }).blocks).toEqual([]);
    expect(marks({ top: 0, left: 4, bottom: 5, right: 5 }).blocks).toEqual([]);
    expect(marks({ top: 0, left: 0, bottom: 1, right: 5 }).blocks).toEqual([]);
    expect(marks({ top: 0, left: 0, bottom: 5, right: 1 }).blocks).toEqual([]);
    expect(marks({ top: 1, left: 3, bottom: 1, right: 3 }).zones).toEqual(BOARD.zones);
    expect(marks({ top: 2, left: 0, bottom: 5, right: 5 }).zones).toEqual([]);
    expect(marks({ top: 0, left: 0, bottom: 0, right: 5 }).zones).toEqual([]);
    expect(marks({ top: 0, left: 4, bottom: 5, right: 5 }).zones).toEqual([]);
    expect(marks({ top: 0, left: 0, bottom: 5, right: 1 }).zones).toEqual([]);
  });
});

describe('the little map', () => {
  it('fits the whole maze in its size, by its longer side', () => {
    const tall = minimapSize({ rows: 40, cols: 32 }, 112);
    expect(tall.scale).toBe(2.8);
    expect(tall.width).toBeCloseTo(89.6);
    expect(tall.height).toBe(112);
    expect(minimapSize({ rows: 50, cols: 100 }, 100)).toEqual({ scale: 1, width: 100, height: 50 });
  });

  it('takes the size picked while it fits its room, and shrinks to fit the room across when it doesn\'t', () => {
    const fit = (board, size, room) => {
      const map = minimapFit(board, size, room);
      return [map.scale, map.width, map.height].map(n => Math.round(n * 1000) / 1000);
    };
    expect(fit({ rows: 100, cols: 100 }, 224, 230)).toEqual([2.24, 224, 224]);
    expect(fit({ rows: 100, cols: 100 }, 224, 224)).toEqual([2.24, 224, 224]);
    expect(fit({ rows: 100, cols: 100 }, 224, 146)).toEqual([1.46, 146, 146]);
    // A tall maze is narrower than its size, so a narrower room still fits it whole.
    expect(fit({ rows: 40, cols: 20 }, 160, 80)).toEqual([4, 80, 160]);
    expect(fit({ rows: 40, cols: 20 }, 160, 60)).toEqual([3, 60, 120]);
    // A wide maze fills its room across.
    expect(fit({ rows: 20, cols: 40 }, 160, 100)).toEqual([2.5, 100, 50]);
  });

  it('draws its lines so many px wide however small a cell is on it, a stop at least half a cell', () => {
    expect(minimapPens(2)).toEqual({ wall: 0.3, trail: 1, box: 0.75, dot: 1.25 });
    expect(minimapPens(10).dot).toBe(0.5);
  });

  it('boxes what\'s on view', () => {
    expect(minimapBox({ cell: 20, x: 3, y: 4 }, { width: 800, height: 400 })).toEqual({ x: 3, y: 4, width: 40, height: 20 });
  });

  it('shows every collectible, key, letter and exit — not the guides — those picked up faded', () => {
    const stops = minimapStops(newMazePlay(BOARD), BOARD);
    expect(stops).toHaveLength(12);
    expect(stops[0]).toEqual({ x: 3.5, y: 1.5, kind: 'collectible', got: false });
    expect(stops.map(s => s.kind)).not.toContain('guide');
    expect(minimapStops(taps([[0, 1], [0, 2], [0, 3]]), BOARD).find(s => s.kind === 'letter' && s.x === 3.5)).toEqual({ x: 3.5, y: 0.5, kind: 'letter', got: true });
    const ended = mazeBoard({ ...structuredClone(MAZE), letters: [], exits: [] });
    expect(minimapStops(newMazePlay(ended), ended).at(-1)).toEqual({ x: 5.5, y: 5.5, kind: 'end', got: false });
  });

  it('draws the trail through each cell\'s centre', () => {
    expect(minimapTrail([[0, 0], [0, 1], [1, 1]])).toBe('M0.5,0.5L1.5,0.5L1.5,1.5');
    expect(minimapTrail([[2, 3]])).toBe('M3.5,2.5');
  });

  it('dragging the box moves the view with it, on the maze', () => {
    const frame = { fit: 8, width: 800, height: 800 }, big = { rows: 100, cols: 100 };
    expect(dragView({ cell: 20, x: 10, y: 10 }, { x: 0, y: 0 }, { x: 5, y: -2.5 }, 2.5, frame, big)).toEqual({ cell: 20, x: 12, y: 9 });
    expect(dragView({ cell: 20, x: 10, y: 10 }, { x: 50, y: 50 }, { x: 0, y: 500 }, 1, frame, big)).toEqual({ cell: 20, x: 0, y: 60 });
    expect(dragView({ cell: 20, x: 10, y: 10 }, { x: 10, y: 10 }, { x: 13, y: 5 }, 1, frame, big)).toEqual({ cell: 20, x: 13, y: 5 });
  });
});
