import { describe, it, expect, beforeEach } from 'vitest';
import { crissBoard, newCrissPlay, tapSquare, tapWord } from '../../../core/crisscross/play-core.js';
import { wordsRow, tapRows, restoredCriss, syncRows, joinedCriss } from '../../../core/crisscross/progress-core.js';
// core/crisscross/progress-core.js, against a small shape, three rows of three:
//   C A T      Cat across from (0,0) is the starting word; Cow down from (0,0), Toe down from (0,2)
//   O . O      and We across from (2,0). Slot i is word i's: 0 We, 1 Cat, 2 Cow, 3 Toe.
//   W E E

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let SMALL;
beforeEach(() => {
  SMALL = crissBoard({
    hiddenId: 'CRSS-0009', type: 'Vanilla', created: '2026-10-12', title: 'Small', difficulty: 'Easy', width: 3, height: 3,
    squares: ['###', '#.#', '###'], given: 'Cat',
    words: [
      { word: 'We', start: { row: 2, col: 0 }, direction: 'E', length: 2 },
      { word: 'Cat', start: { row: 0, col: 0 }, direction: 'E', length: 3 },
      { word: 'Cow', start: { row: 0, col: 0 }, direction: 'S', length: 3 },
      { word: 'Toe', start: { row: 0, col: 2 }, direction: 'S', length: 3 }
    ]
  });
});

const WE = { row: 2, col: 0, direction: 'E', word: 'We' };
const COW = { row: 0, col: 0, direction: 'S', word: 'Cow' };
const TOE = { row: 0, col: 2, direction: 'S', word: 'Toe' };
// Each step a square tapped, then a word: [row, col] then the word's index.
const place = (steps, play) => steps.reduce((p, [cell, word]) => tapWord(tapSquare(p, cell, SMALL), word, SMALL), play || newCrissPlay(SMALL));
const row = (words, finished = false) => ({ puzzle: 'CRSS-0009', words, finished });

describe('the shape\'s row', () => {
  it('a new shape is its hidden ID and no words — the starting word is never saved — unfinished', () => {
    expect(wordsRow('CRSS-0009', newCrissPlay(SMALL), SMALL)).toEqual(row([]));
  });

  it('lists each word in place as its slot\'s first square, its way and the word as listed, slot by slot', () => {
    expect(wordsRow('CRSS-0009', place([[[2, 2], 3], [[1, 0], 2]]), SMALL)).toEqual(row([COW, TOE]));
  });

  it('says finished once the shape is', () => {
    expect(wordsRow('CRSS-0009', place([[[1, 0], 2], [[1, 2], 3], [[2, 1], 0]]), SMALL)).toEqual(row([WE, COW, TOE], true));
  });
});

describe('what a tap saves', () => {
  it('a word put in saves every word in place', () => {
    const before = place([[[1, 0], 2]]);
    expect(tapRows('CRSS-0009', before, place([[[1, 2], 3]], before), SMALL)).toEqual([row([COW, TOE])]);
  });

  it('a word taken out saves the words left', () => {
    const before = place([[[1, 0], 2]]);
    expect(tapRows('CRSS-0009', before, tapWord(before, 2, SMALL), SMALL)).toEqual([row([])]);
  });

  it('the word that finishes the shape saves it finished', () => {
    const before = place([[[1, 0], 2], [[1, 2], 3]]);
    expect(tapRows('CRSS-0009', before, place([[[2, 1], 0]], before), SMALL)).toEqual([row([WE, COW, TOE], true)]);
  });

  it('picking a slot, or a word refused, saves nothing', () => {
    const start = newCrissPlay(SMALL), picked = tapSquare(start, [1, 0], SMALL);
    expect(tapRows('CRSS-0009', start, picked, SMALL)).toEqual([]);
    expect(tapRows('CRSS-0009', picked, tapWord(picked, 0, SMALL), SMALL)).toEqual([]);
  });
});

describe('a saved shape coming back', () => {
  it('no row, and the shape is new, the starting word in', () => {
    expect(restoredCriss(SMALL, [])).toEqual(newCrissPlay(SMALL));
  });

  it('its words back in their slots, nothing picked and nothing set off', () => {
    expect(restoredCriss(SMALL, [row([COW, TOE])])).toEqual({ placed: { 1: 1, 2: 2, 3: 3 }, picked: -1, events: [], clashes: [], note: '' });
  });

  it('a word comes back in the slot it was saved in, even another of its length\'s', () => {
    expect(restoredCriss(SMALL, [row([{ ...TOE, word: 'Cow' }])]).placed).toEqual({ 1: 1, 3: 2 });
  });

  it('a finished shape comes back finished, and takes no more taps', () => {
    const play = restoredCriss(SMALL, [row([WE, COW, TOE], true)]);
    expect(play.events).toEqual([]);
    expect(tapWord(play, 2, SMALL).placed).toEqual(play.placed);
  });

  it('a word saved at a square or a way no slot starts at puts nothing in', () => {
    expect(restoredCriss(SMALL, [row([{ ...WE, row: 1 }, { ...WE, col: 1 }, { ...WE, direction: 'S' }])]).placed).toEqual({ 1: 1 });
  });

  it('a word saved in the starting word\'s slot, or a slot already filled, puts nothing in', () => {
    expect(restoredCriss(SMALL, [row([{ row: 0, col: 0, direction: 'E', word: 'Toe' }])]).placed).toEqual({ 1: 1 });
    expect(restoredCriss(SMALL, [row([COW, { ...COW, word: 'Toe' }])]).placed).toEqual({ 1: 1, 2: 2 });
  });

  it('a word not in the list, already in, or not its slot\'s length puts nothing in', () => {
    expect(restoredCriss(SMALL, [row([{ ...COW, word: 'Cog' }, { ...COW, word: 'COW' }])]).placed).toEqual({ 1: 1 });
    expect(restoredCriss(SMALL, [row([{ ...COW, word: 'Cat' }, { ...TOE, word: 'Cow' }, COW])]).placed).toEqual({ 1: 1, 3: 2 });
    expect(restoredCriss(SMALL, [row([{ ...COW, word: 'We' }])]).placed).toEqual({ 1: 1 });
  });

  it('two words spelt the same each come back', () => {
    const twins = crissBoard({
      hiddenId: 'CRSS-0010', type: 'Vanilla', created: '2026-10-12', title: 'Twins', difficulty: 'Easy', width: 2, height: 2,
      squares: ['##', '#.'], given: 'Ab',
      words: [{ word: 'Ab', start: { row: 0, col: 0 }, direction: 'E', length: 2 }, { word: 'Ab', start: { row: 0, col: 0 }, direction: 'S', length: 2 }]
    });
    expect(restoredCriss(twins, [{ words: [{ row: 0, col: 0, direction: 'S', word: 'Ab' }] }]).placed).toEqual({ 0: 0, 1: 1 });
  });

  it('only the first row counts — there is only ever one', () => {
    expect(restoredCriss(SMALL, [row([COW]), row([TOE])]).placed).toEqual({ 1: 1, 2: 2 });
  });
});

describe('signing in mid-shape', () => {
  it('a player who has placed a word saves the shape on screen', () => {
    expect(syncRows('CRSS-0009', place([[[1, 2], 3]]), SMALL)).toEqual([row([TOE])]);
  });

  it('a player who hasn\'t placed a word — only the starting one is in — saves nothing', () => {
    expect(syncRows('CRSS-0009', newCrissPlay(SMALL), SMALL)).toEqual([]);
  });

  it('words on screen are kept over the saved shape, with the slot picked, and nothing is set off', () => {
    const play = { placed: { 1: 1, 3: 3 }, picked: 2, events: ['placed'], clashes: [[0, 0]], note: 'Pick a slot first, then the word.' };
    expect(joinedCriss(play, restoredCriss(SMALL, [row([COW])]), SMALL)).toEqual({ ...play, events: [], clashes: [] });
  });

  it('with no word placed on screen, the saved shape comes back', () => {
    const saved = restoredCriss(SMALL, [row([COW])]);
    expect(joinedCriss(tapSquare(newCrissPlay(SMALL), [1, 0], SMALL), saved, SMALL)).toBe(saved);
  });
});
