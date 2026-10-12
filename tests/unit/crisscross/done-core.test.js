import { describe, it, expect } from 'vitest';
import { doneShapes, playingShapes } from '../../../core/crisscross/done-core.js';
// core/crisscross/done-core.js: a criss-cross's row says itself whether it's finished.

const COW = { row: 0, col: 0, direction: 'S', word: 'Cow' };
const row = (puzzle, words, finished = false) => ({ puzzle, words, finished, placed_at: '2026-10-12T00:00:00+00:00' });
const tile = (...ids) => ({ ids });

describe('finished criss-crosses', () => {
  it('are the shapes the tiles stand for whose row says finished', () => {
    const rows = [row('CRSS-0001', [COW], true), row('CRSS-0002', [COW]), row('CRSS-0003', [COW], true)];
    expect(doneShapes(rows, [tile('CRSS-0001'), tile('CRSS-0002')])).toEqual(['CRSS-0001']);
  });

  it('a row with no finished, or anything but true, is not finished', () => {
    expect(doneShapes([{ puzzle: 'CRSS-0001', words: [] }, { ...row('CRSS-0002', []), finished: 'true' }], [tile('CRSS-0001', 'CRSS-0002')])).toEqual([]);
  });

  it('a collection\'s tile stands for each of its shapes', () => {
    expect(doneShapes([row('CRSS-0002', [COW], true)], [tile('CRSS-0001', 'CRSS-0002')])).toEqual(['CRSS-0002']);
  });

  it('no rows, none finished', () => {
    expect(doneShapes([], [tile('CRSS-0001')])).toEqual([]);
  });
});

describe('criss-crosses in play', () => {
  it('are the shapes the tiles stand for with a word placed, and not finished', () => {
    const rows = [row('CRSS-0001', [COW]), row('CRSS-0002', [COW, COW]), row('CRSS-0003', [COW], true), row('CRSS-0004', [COW])];
    expect(playingShapes(rows, [tile('CRSS-0001'), tile('CRSS-0002'), tile('CRSS-0003')], ['CRSS-0003'])).toEqual(['CRSS-0001', 'CRSS-0002']);
  });

  it('a shape whose every word was taken out — only the starting word left — is not in play', () => {
    expect(playingShapes([row('CRSS-0001', [])], [tile('CRSS-0001')], [])).toEqual([]);
  });
});
