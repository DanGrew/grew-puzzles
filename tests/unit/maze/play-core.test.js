import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import {
  mazeUrl, wallPath, mazeBoard, newMazePlay, tapMaze, checklist, mazeFinished, checklistCount, trailPoints, stopMarks,
  zoneMarks, solutionMarks, mazeCellSize
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
});

describe('the walls', () => {
  it('draws each cell\'s north and west walls, and the edge along the bottom row and right column', () => {
    expect(wallPath(['F', 'F'])).toBe('M0 0h1M0 0v1M1 0v1' + 'M0 1h1M0 1v1M0 2h1M1 1v1');
    expect(wallPath(['FF'])).toBe('M0 0h1M0 0v1M0 1h1' + 'M1 0h1M1 0v1M1 1h1M2 0v1');
  });

  it('draws no wall a cell leaves open', () => {
    expect(wallPath(['0'])).toBe('');
    expect(wallPath(['2', '4'])).toBe('M1 0v1M0 2h1');
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
    expect(BOARD.walls).toBe(wallPath(MAZE.walls));
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
  it('starts at the start, holding nothing', () => {
    expect(newMazePlay(BOARD)).toEqual({ trail: [[0, 0]], got: [], events: [], locked: [] });
  });

  it('goes on to an open cell beside the trail\'s end, each way', () => {
    expect(taps([[0, 1]]).trail).toEqual([[0, 0], [0, 1]]);
    expect(taps([[1, 0]]).trail).toEqual([[0, 0], [1, 0]]);
    expect(taps([[0, 1], [0, 2], [1, 2], [1, 3]], taps([[1, 0], [2, 0], [2, 1], [2, 0], [1, 0], [0, 0]])).trail.slice(-2)).toEqual([[1, 2], [1, 3]]);
    expect(taps([[1, 0], [2, 0], [2, 1], [1, 1]]).trail.at(-1)).toEqual([1, 1]);
    expect(taps([[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5]]).trail.at(-1)).toEqual([1, 5]);
    expect(taps([[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 5], [0, 5]]).trail.at(-1)).toEqual([0, 5]);
    expect(tapMaze({ trail: [[1, 5]], got: [], events: [], locked: [] }, [1, 4], BOARD).trail).toEqual([[1, 5], [1, 4]]);
  });

  it('does nothing for a cell through a wall, one not beside the trail\'s end, or one corner to corner', () => {
    const one = taps([[0, 1]]);
    [[1, 1], [0, 3], [1, 2], [1, 0], [5, 5]].forEach(cell => {
      expect(tapMaze(one, cell, BOARD)).toEqual({ trail: one.trail, got: [], events: [], locked: [] });
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
    expect(refused).toEqual({ trail: before.trail, got: before.got, events: ['locked'], locked: [1] });
    const keyed = taps([[1, 0], [2, 0], [2, 1], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2]]);
    expect(keyed.trail.at(-1)).toEqual([1, 2]);
    expect(keyed.events).toEqual([]);
    expect(keyed.locked).toEqual([]);
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

  it('draws the solution: the main path, each detour step, and the exits, the right one apart', () => {
    const marks = solutionMarks(BOARD);
    expect(marks.main).toBe(trailPoints(BOARD.main));
    expect(marks.detours.startsWith('M0.5,2.5L1.5,2.5M1.5,2.5L0.5,2.5')).toBe(true);
    expect(marks.detours.match(/M/g)).toHaveLength(26);
    expect(marks.exits).toHaveLength(6);
    expect(marks.exits.filter(e => e.right)).toEqual([{ cell: [5, 5], right: true }]);
    expect(marks.exits[0]).toEqual({ cell: [3, 4], right: false });
  });

  it('a maze without letters has no exits to mark on its solution', () => {
    const board = mazeBoard({ ...structuredClone(MAZE), letters: [], exits: [] });
    expect(solutionMarks(board).exits).toEqual([]);
  });
});

describe('how big the maze is', () => {
  const room = { viewHeight: 900, chromeHeight: 100, width: 1000, chromeWidth: 40, rows: 40, cols: 32 };

  it('fits the window\'s height when that is the tighter', () => {
    expect(mazeCellSize(room)).toBe(20);
    expect(mazeCellSize({ ...room, viewHeight: 939 })).toBe(20);
    expect(mazeCellSize({ ...room, viewHeight: 940 })).toBe(21);
  });

  it('fits the page\'s width when that is the tighter', () => {
    expect(mazeCellSize({ ...room, width: 400 })).toBe(11);
    expect(mazeCellSize({ ...room, width: 40 + 32 * 12 })).toBe(12);
    expect(mazeCellSize({ ...room, width: 39 + 32 * 12 })).toBe(11);
  });

  it('never draws a cell under 10px', () => {
    expect(mazeCellSize({ ...room, viewHeight: 300 })).toBe(10);
    expect(mazeCellSize({ ...room, viewHeight: 100 + 40 * 11 })).toBe(11);
  });
});
