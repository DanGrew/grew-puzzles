import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import {
  crissUrl, crissFile, wordLetters, crissBoard, newCrissPlay, crissFull, crissFinished, tapSquare, tapWord, crissSquares,
  squareMarks, placedSquares, crissCount, wordGroups, pickingLine, crissStatus, answerSquares, crissFrame, minimapSquares
} from '../../../core/crisscross/play-core.js';
const require = createRequire(import.meta.url);
// core/crisscross/play-core.js, against CRSS-0001 — a real 17×15 Easy shape made by tooling's
// generator and passing its checks — and a small shape of its own, Tent given:
//   K I T E .      1 Kite across, 2 Tent down, 3 Net across, 4 Dog down, 5 Cat across
//   . . E . .      Kite crosses Tent at its T, Net crosses it at its N; Cat and Dog cross
//   . . N E T      nothing, so either fits the other's slot, and so does Net
//   . . T . D
//   . . . . O
//   C A T . G
const SHAPE_FILE = require('../../fixtures/CRSS-0001.json');
const CAT = 0, DOG = 1, NET = 2, KITE = 3, TENT = 4;

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let SHAPE, SMALL;
beforeEach(() => {
  SHAPE = crissBoard(structuredClone(SHAPE_FILE));
  SMALL = crissBoard({
    hiddenId: 'CRSS-0009', type: 'Vanilla', created: '2026-10-12', title: 'Small', difficulty: 'Hard', width: 5, height: 6,
    wordGroups: ['holidays'], squares: ['####.', '..#..', '..###', '..#.#', '....#', '###.#'], given: 'Tent',
    words: [
      { word: 'Cat', start: { row: 5, col: 0 }, direction: 'E', length: 3 },
      { word: 'Dog', start: { row: 3, col: 4 }, direction: 'S', length: 3 },
      { word: 'Net', start: { row: 2, col: 2 }, direction: 'E', length: 3 },
      { word: 'Kite', start: { row: 0, col: 0 }, direction: 'E', length: 4 },
      { word: 'Tent', start: { row: 0, col: 2 }, direction: 'S', length: 4 }
    ]
  });
});

// A slot picked by tapping its first square — twice, where it starts on another's — then a word
// tapped into it.
function pick(play, slot, board) {
  const once = tapSquare(play, board.slots[slot].cells[0], board);
  return once.picked === slot ? once : tapSquare(once, board.slots[slot].cells[0], board);
}

function put(play, slot, word, board) {
  return tapWord(pick(play, slot, board), word, board);
}

function solved(board) {
  return board.slots.reduce((p, s, i) => i === board.given ? p : put(p, i, i, board), newCrissPlay(board));
}

describe('finding the shape a play URL names', () => {
  it('names a shape by its hidden ID, its file under the criss-cross kind', () => {
    expect(crissUrl('?id=CRSS-0001')).toBe('../content/puzzles/crisscross/CRSS-0001.json');
    expect(crissUrl('?id=CRSS-12345')).toBe('../content/puzzles/crisscross/CRSS-12345.json');
    expect(crissFile('CRSS-0042')).toBe('../content/puzzles/crisscross/CRSS-0042.json');
  });

  it('names no shape for anything else, so nothing else becomes a path', () => {
    ['', '?id=', '?id=MINE-0001', '?id=CRSS-001', '?id=CRSS-0001/../x', '?id=xCRSS-0001', '?id=CRSS-0001x'].forEach(search => {
      expect(() => crissUrl(search)).toThrow('No such puzzle');
    });
  });
});

describe('the shape', () => {
  it('holds its title, difficulty, code, bands and size', () => {
    expect(SHAPE).toMatchObject({
      title: 'Summer Holidays', difficulty: 'Easy', code: 'CRSS-0001', label: 'Vanilla', solutionLabel: 'Vanilla · Solution',
      cols: 17, rows: 15
    });
    expect(SMALL).toMatchObject({ difficulty: 'Hard', cols: 5, rows: 6 });
  });

  it('reads a word as its squares hold it: accents off, uppercase', () => {
    expect(wordLetters('Café')).toBe('CAFE');
    expect(wordLetters('Piñata')).toBe('PINATA');
    expect(SMALL.words[KITE]).toEqual({ word: 'Kite', letters: 'KITE' });
  });

  it('reads its squares in use, row by row', () => {
    expect(SMALL.squares.slice(0, 6)).toEqual([[0, 0], [0, 1], [0, 2], [0, 3], [1, 2], [2, 2]]);
    expect(SMALL.squares).toHaveLength(15);
    expect(SHAPE.squares).toHaveLength(SHAPE_FILE.squares.join('').replace(/\./g, '').length);
  });

  it('gives each word a slot at its place, across or down, numbered as a crossword\'s starts are', () => {
    expect(SMALL.slots[KITE]).toEqual({ cells: [[0, 0], [0, 1], [0, 2], [0, 3]], length: 4, across: true, answer: 'KITE', number: 1 });
    expect(SMALL.slots[TENT]).toEqual({ cells: [[0, 2], [1, 2], [2, 2], [3, 2]], length: 4, across: false, answer: 'TENT', number: 2 });
    expect(SMALL.slots.map(s => s.number)).toEqual([5, 4, 3, 1, 2]);
  });

  it('two slots starting on one square share its number', () => {
    const bonfire = SHAPE.words.findIndex(w => w.word === 'Bonfire'), barbecue = SHAPE.words.findIndex(w => w.word === 'Barbecue');
    expect(SHAPE.slots[bonfire].number).toBe(SHAPE.slots[barbecue].number);
    // Beach and Breeze start together too: 20 slots, 18 starts, numbered 1 to 18.
    expect(new Set(SHAPE.slots.map(s => s.number)).size).toBe(18);
    expect(Math.max(...SHAPE.slots.map(s => s.number))).toBe(18);
  });

  it('knows its starting word', () => {
    expect(SMALL.given).toBe(TENT);
    expect(SHAPE.words[SHAPE.given].word).toBe('Aquarium');
  });
});

describe('starting', () => {
  it('starts with only the starting word in place, nothing picked and nothing set off', () => {
    expect(newCrissPlay(SMALL)).toEqual({ placed: { 4: TENT }, picked: -1, events: [], clashes: [], note: '' });
  });
});

describe('tapping a square', () => {
  it('picks the across slot through it', () => {
    expect(tapSquare(newCrissPlay(SMALL), [0, 1], SMALL).picked).toBe(KITE);
    expect(tapSquare(newCrissPlay(SMALL), [4, 4], SMALL).picked).toBe(DOG);
  });

  it('where two slots cross, picks across first, then the down slot, then across again', () => {
    const bonfire = SHAPE.words.findIndex(w => w.word === 'Bonfire'), barbecue = SHAPE.words.findIndex(w => w.word === 'Barbecue');
    const once = tapSquare(newCrissPlay(SHAPE), [8, 0], SHAPE);
    expect(once.picked).toBe(barbecue);
    expect(tapSquare(once, [8, 0], SHAPE).picked).toBe(bonfire);
    expect(tapSquare(tapSquare(once, [8, 0], SHAPE), [8, 0], SHAPE).picked).toBe(barbecue);
  });

  it('where only one slot runs, a second tap lets it go', () => {
    const once = tapSquare(newCrissPlay(SMALL), [0, 1], SMALL);
    expect(tapSquare(once, [0, 0], SMALL).picked).toBe(-1);
  });

  it('a square of another slot picks that one', () => {
    const once = tapSquare(newCrissPlay(SMALL), [0, 1], SMALL);
    expect(tapSquare(once, [5, 1], SMALL).picked).toBe(CAT);
  });

  it('never picks the starting word\'s slot: where it crosses another, that one; on its own, nothing', () => {
    expect(tapSquare(newCrissPlay(SMALL), [1, 2], SMALL).picked).toBe(-1);
    expect(tapSquare(newCrissPlay(SMALL), [0, 2], SMALL).picked).toBe(KITE);
    expect(tapSquare(newCrissPlay(SMALL), [2, 2], SMALL).picked).toBe(NET);
    const picked = tapSquare(newCrissPlay(SMALL), [5, 0], SMALL);
    expect(tapSquare(picked, [1, 2], SMALL).picked).toBe(-1);
  });

  it('clears what the last tap set off, and keeps the words', () => {
    const clashed = put(newCrissPlay(SMALL), NET, CAT, SMALL);
    const next = tapSquare(clashed, [0, 0], SMALL);
    expect(next).toEqual({ placed: clashed.placed, picked: KITE, events: [], clashes: [], note: '' });
  });

  it('once solved, picks nothing new', () => {
    const done = solved(SMALL);
    expect(tapSquare(done, [0, 0], SMALL).picked).toBe(-1);
    expect(tapSquare({ ...done, picked: CAT }, [0, 0], SMALL).picked).toBe(CAT);
  });
});

describe('tapping a word', () => {
  it('puts a word that fits into the slot picked, crosses it off, and lets the slot go', () => {
    const next = put(newCrissPlay(SMALL), KITE, KITE, SMALL);
    expect(next).toEqual({ placed: { 3: KITE, 4: TENT }, picked: -1, events: ['placed'], clashes: [], note: '' });
  });

  it('with nothing picked, says to pick a slot first', () => {
    const next = tapWord(newCrissPlay(SMALL), CAT, SMALL);
    expect(next).toEqual({ placed: { 4: TENT }, picked: -1, events: [], clashes: [], note: 'Pick a slot first, then the word.' });
  });

  it('a word of another length is refused, and the slot stays picked', () => {
    const next = put(newCrissPlay(SMALL), CAT, KITE, SMALL);
    expect(next).toEqual({ placed: { 4: TENT }, picked: CAT, events: [], clashes: [], note: 'That slot needs a 3-letter word.' });
  });

  it('a word clashing with letters already in the slot is refused, its clashing squares named', () => {
    const next = put(newCrissPlay(SMALL), NET, CAT, SMALL);
    expect(next).toEqual({
      placed: { 4: TENT }, picked: NET, events: ['clash'], clashes: [[2, 2]], note: "Cat doesn't fit the letters already there."
    });
  });

  it('a letter that agrees is no clash, and only the squares that disagree are named', () => {
    const withNet = put(newCrissPlay(SMALL), NET, NET, SMALL);
    expect(withNet.events).toEqual(['placed']);
    // Kite's T falls on Tent's T.
    expect(put(withNet, KITE, KITE, SMALL).events).toEqual(['placed']);
  });

  it('a word clashes against every filled slot through the slot\'s squares, not its own word', () => {
    const shape = crissBoard(structuredClone(SHAPE_FILE));
    const bonfire = shape.words.findIndex(w => w.word === 'Bonfire'), barbecue = shape.words.findIndex(w => w.word === 'Barbecue');
    const fishing = shape.words.findIndex(w => w.word === 'Fishing'), lantern = shape.words.findIndex(w => w.word === 'Lantern');
    const inBarbecue = put(newCrissPlay(shape), barbecue, barbecue, shape);
    // Fishing begins with F, Lantern with L, where Barbecue gives the B: refused.
    const clash = put(inBarbecue, bonfire, fishing, shape);
    expect(clash.events).toEqual(['clash']);
    expect(clash.clashes).toEqual([[8, 0]]);
    expect(put(inBarbecue, bonfire, lantern, shape).clashes).toEqual([[8, 0]]);
    expect(put(inBarbecue, bonfire, bonfire, shape).events).toEqual(['placed']);
  });

  it('a word already in the slot picked is replaced, and its letters don\'t refuse the new one', () => {
    const withCat = put(newCrissPlay(SMALL), CAT, CAT, SMALL);
    const next = put(withCat, CAT, DOG, SMALL);
    expect(next.placed).toEqual({ 0: DOG, 4: TENT });
    expect(next.events).toEqual(['placed']);
  });

  it('a word in the shape tapped with nothing picked comes out', () => {
    const withCat = put(newCrissPlay(SMALL), CAT, CAT, SMALL);
    const next = tapWord(withCat, CAT, SMALL);
    expect(next).toEqual({ placed: { 4: TENT }, picked: -1, events: [], clashes: [], note: '' });
  });

  it('a word tapped with its own slot picked comes out, the slot staying picked', () => {
    const withCat = put(newCrissPlay(SMALL), CAT, CAT, SMALL);
    const next = put(withCat, CAT, CAT, SMALL);
    expect(next).toEqual({ placed: { 4: TENT }, picked: CAT, events: [], clashes: [], note: '' });
  });

  it('a word in the shape tapped with another slot picked moves there', () => {
    const withCat = put(newCrissPlay(SMALL), CAT, CAT, SMALL);
    const next = put(withCat, DOG, CAT, SMALL);
    expect(next.placed).toEqual({ 1: CAT, 4: TENT });
    expect(next.picked).toBe(-1);
  });

  it('letters another word shares stay when a word comes out', () => {
    const withKite = put(newCrissPlay(SMALL), KITE, KITE, SMALL);
    const out = tapWord(withKite, KITE, SMALL);
    expect(squareMarks(out, SMALL).find(m => m.key === '0,2').letter).toBe('T');
    expect(squareMarks(out, SMALL).find(m => m.key === '0,1').letter).toBe('');
  });

  it('the starting word never moves', () => {
    const picked = tapSquare(newCrissPlay(SMALL), [0, 0], SMALL);
    expect(tapWord(picked, TENT, SMALL)).toEqual({ placed: { 4: TENT }, picked: KITE, events: [], clashes: [], note: '' });
    expect(tapWord(newCrissPlay(SMALL), TENT, SMALL).placed).toEqual({ 4: TENT });
  });

  it('the word that fills every slot right sets off complete; once solved, words take no more taps', () => {
    const almost = [CAT, DOG, NET].reduce((p, i) => put(p, i, i, SMALL), newCrissPlay(SMALL));
    const done = put(almost, KITE, KITE, SMALL);
    expect(done.events).toEqual(['placed', 'complete']);
    expect(tapWord(done, CAT, SMALL)).toEqual({ placed: done.placed, picked: -1, events: [], clashes: [], note: '' });
  });
});

describe('full, and right', () => {
  it('is full once every slot holds a word, and right once each holds its own', () => {
    const wrong = [[CAT, DOG], [DOG, CAT], [NET, NET], [KITE, KITE]].reduce((p, [s, w]) => put(p, s, w, SMALL), newCrissPlay(SMALL));
    expect(crissFull(wrong, SMALL)).toBe(true);
    expect(crissFinished(wrong, SMALL)).toBe(false);
    expect(wrong.events).toEqual(['placed']);
    expect(crissFull(newCrissPlay(SMALL), SMALL)).toBe(false);
    expect(crissFinished(newCrissPlay(SMALL), SMALL)).toBe(false);
    expect(crissFinished(solved(SMALL), SMALL)).toBe(true);
    expect(crissFinished(solved(SHAPE), SHAPE)).toBe(true);
  });

  it('a word spelt as the slot\'s own reads the same, and counts as right', () => {
    const board = structuredClone(SMALL);
    board.words[DOG] = { word: 'Cat', letters: 'CAT' };
    board.words[CAT] = { word: 'Dog', letters: 'DOG' };
    const play = { placed: { 0: DOG, 1: CAT, 2: NET, 3: KITE, 4: TENT } };
    expect(crissFinished(play, board)).toBe(true);
  });

  it('says solved, or — full but wrong — only that some word is, else nothing', () => {
    const wrong = [[CAT, DOG], [DOG, CAT], [NET, NET], [KITE, KITE]].reduce((p, [s, w]) => put(p, s, w, SMALL), newCrissPlay(SMALL));
    expect(crissStatus(solved(SMALL), SMALL)).toEqual({ state: 'solved', text: 'Solved — every word in place' });
    expect(crissStatus(wrong, SMALL)).toEqual({ state: 'wrong', text: 'Every word is in, but some are in the wrong place.' });
    expect(crissStatus(newCrissPlay(SMALL), SMALL)).toEqual({ state: '', text: '' });
  });
});

describe('what the shape shows', () => {
  it('every square in use, its number where a slot starts', () => {
    const squares = crissSquares(SMALL);
    expect(squares).toHaveLength(15);
    expect(squares[0]).toEqual({ cell: [0, 0], key: '0,0', number: '1' });
    expect(squares[1]).toEqual({ cell: [0, 1], key: '0,1', number: '' });
    expect(squares.filter(s => s.number).map(s => s.number)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('each square its letter, whether it\'s picked or given, and what a screen reader hears', () => {
    const play = tapSquare(put(newCrissPlay(SMALL), NET, NET, SMALL), [0, 0], SMALL);
    const marks = new Map(squareMarks(play, SMALL).map(m => [m.key, m]));
    expect(marks.get('0,0')).toEqual({ key: '0,0', letter: '', picked: true, given: false, label: 'Row 1, column 1, empty' });
    expect(marks.get('0,2')).toEqual({ key: '0,2', letter: 'T', picked: true, given: true, label: 'Row 1, column 3, T' });
    expect(marks.get('2,4')).toEqual({ key: '2,4', letter: 'T', picked: false, given: false, label: 'Row 3, column 5, T' });
    expect(marks.get('5,0').picked).toBe(false);
  });

  it('with nothing picked, no square is', () => {
    expect(squareMarks(newCrissPlay(SMALL), SMALL).some(m => m.picked)).toBe(false);
  });

  it('the squares of the slot just filled, and none when a word came out or was refused', () => {
    const start = newCrissPlay(SMALL);
    const withCat = put(start, CAT, CAT, SMALL);
    expect(placedSquares(withCat, SMALL, start)).toEqual(['5,0', '5,1', '5,2']);
    const moved = put(withCat, DOG, CAT, SMALL);
    expect(placedSquares(moved, SMALL, withCat)).toEqual(['3,4', '4,4', '5,4']);
    const replaced = put(withCat, CAT, DOG, SMALL);
    expect(placedSquares(replaced, SMALL, withCat)).toEqual(['5,0', '5,1', '5,2']);
    expect(placedSquares(tapWord(withCat, CAT, SMALL), SMALL, withCat)).toEqual([]);
    expect(placedSquares(start, SMALL, start)).toEqual([]);
  });

  it('counts the words in the shape, the starting word among them', () => {
    expect(crissCount(newCrissPlay(SMALL), SMALL)).toBe('1/5');
    expect(crissCount(put(newCrissPlay(SMALL), CAT, CAT, SMALL), SMALL)).toBe('2/5');
    expect(crissCount(newCrissPlay(SHAPE), SHAPE)).toBe('1/20');
  });

  it('the answer: every square its letter', () => {
    const answer = new Map(answerSquares(SMALL).map(s => [s.key, s]));
    expect(answer.size).toBe(15);
    expect(answer.get('0,0')).toEqual({ cell: [0, 0], key: '0,0', number: '1', letter: 'K' });
    expect(answer.get('2,2').letter).toBe('N');
    expect(answer.get('5,4').letter).toBe('G');
    expect(answerSquares(SHAPE).every(s => /^[A-Z]$/.test(s.letter))).toBe(true);
  });
});

describe('the Words card', () => {
  it('groups the words by length, shortest first, each in the list\'s order', () => {
    const groups = wordGroups(newCrissPlay(SMALL), SMALL);
    expect(groups.map(g => g.heading)).toEqual(['3 letters', '4 letters']);
    expect(groups.map(g => g.length)).toEqual([3, 4]);
    expect(groups[0].words.map(w => w.word)).toEqual(['Cat', 'Dog', 'Net']);
    expect(groups[1].words.map(w => w.index)).toEqual([KITE, TENT]);
    expect(wordGroups(newCrissPlay(SHAPE), SHAPE).map(g => g.length)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('shortest first whatever order the list is in', () => {
    const longFirst = crissBoard({ ...SHAPE_FILE, words: [...SHAPE_FILE.words].reverse() });
    expect(wordGroups(newCrissPlay(longFirst), longFirst).map(g => g.length)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('the starting word is crossed off for good, the others as they go in', () => {
    const play = put(newCrissPlay(SMALL), CAT, CAT, SMALL);
    const words = wordGroups(play, SMALL).flatMap(g => g.words);
    expect(words[TENT]).toMatchObject({ used: true, given: true, title: 'Given to start you off' });
    expect(words[CAT]).toMatchObject({ used: true, given: false, title: 'Tap to take it out' });
    expect(words[DOG]).toMatchObject({ used: false, given: false, title: '' });
  });

  it('with nothing picked, nothing dims and no word shows under the shape', () => {
    const groups = wordGroups(newCrissPlay(SMALL), SMALL);
    expect(groups.map(g => g.dim)).toEqual([false, false]);
    expect(groups.flatMap(g => g.words).some(w => w.picked)).toBe(false);
  });

  it('with a slot picked, the other lengths dim, and its length\'s words show under the shape', () => {
    const groups = wordGroups(tapSquare(newCrissPlay(SMALL), [0, 0], SMALL), SMALL);
    expect(groups.map(g => g.dim)).toEqual([true, false]);
    expect(groups.flatMap(g => g.words).filter(w => w.picked).map(w => w.word)).toEqual(['Kite', 'Tent']);
  });
});

describe('the line over the words', () => {
  it('says what to do with nothing picked', () => {
    expect(pickingLine(newCrissPlay(SMALL), SMALL)).toEqual(['Tap a square to pick a slot.', '', '']);
  });

  it('names the slot picked, across or down, and how long', () => {
    expect(pickingLine(tapSquare(newCrissPlay(SMALL), [0, 0], SMALL), SMALL)).toEqual(['Picked: ', '1 across', ', 4 letters']);
    expect(pickingLine(tapSquare(newCrissPlay(SMALL), [4, 4], SMALL), SMALL)).toEqual(['Picked: ', '4 down', ', 3 letters']);
  });

  it('and the word it holds', () => {
    const play = tapSquare(put(newCrissPlay(SMALL), CAT, CAT, SMALL), [5, 0], SMALL);
    expect(pickingLine(play, SMALL)).toEqual(['Picked: ', '5 across', ', 3 letters · holds Cat']);
  });

  it('a note about the last tap comes first', () => {
    expect(pickingLine(tapWord(newCrissPlay(SMALL), CAT, SMALL), SMALL)).toEqual(['Pick a slot first, then the word.', '', '']);
  });
});

describe('the frame', () => {
  const room = { viewHeight: 800, chromeHeight: 100, width: 1000, chromeWidth: 400 };

  it('fits the shape to the room, a whole pixel a square, never over 36px', () => {
    expect(crissFrame({ ...room, rows: 15, cols: 17 })).toEqual({ fit: 35, width: 595, height: 525 });
    expect(crissFrame({ ...room, rows: 5, cols: 5 })).toEqual({ fit: 36, width: 180, height: 180 });
    expect(crissFrame({ ...room, viewHeight: 700, rows: 30, cols: 29 })).toEqual({ fit: 20, width: 580, height: 600 });
  });

  it('takes the narrower of the window\'s height and the page\'s width', () => {
    expect(crissFrame({ ...room, width: 700, rows: 15, cols: 17 })).toEqual({ fit: 17, width: 289, height: 255 });
  });

  it('under 10px a square, every bit of room counts', () => {
    const frame = crissFrame({ ...room, viewHeight: 260, rows: 30, cols: 29 });
    expect(frame.fit).toBeCloseTo(16 / 3);
    expect(frame.width).toBeCloseTo(29 * 16 / 3);
    expect(frame.height).toBeCloseTo(160);
  });
});

describe('the little map', () => {
  it('each square in use, empty, filled, or in the slot picked', () => {
    const play = tapSquare(put(newCrissPlay(SMALL), CAT, CAT, SMALL), [4, 4], SMALL);
    const map = new Map(minimapSquares(play, SMALL).map(s => [s.y + ',' + s.x, s.ink]));
    expect(map.size).toBe(15);
    expect(map.get('0,0')).toBe('empty');
    expect(map.get('1,2')).toBe('filled');
    expect(map.get('5,0')).toBe('filled');
    expect(map.get('3,4')).toBe('picked');
    expect(minimapSquares(play, SMALL)[0]).toEqual({ x: 0, y: 0, ink: 'empty' });
  });
});
