import { describe, it, expect } from 'vitest';
import { doneMosaics, playingMosaics, mosaicNames } from '../../../core/mosaic/done-core.js';
// core/mosaic/done-core.js: a mosaic's row says itself whether it's finished, and only rows with a
// square marked are read, so every row is started.

const row = (puzzle, finished = false) => ({ puzzle, finished, tapped_at: '2026-10-15T00:00:00+00:00' });
const tile = (...ids) => ({ ids });

describe('finished mosaics', () => {
  it('are the mosaics the tiles stand for whose row says finished', () => {
    const rows = [row('MOSA-0001', true), row('MOSA-0002'), row('MOSA-0003', true)];
    expect(doneMosaics(rows, [tile('MOSA-0001'), tile('MOSA-0002')])).toEqual(['MOSA-0001']);
  });

  it('a row with no finished, or anything but true, is not finished', () => {
    expect(doneMosaics([{ puzzle: 'MOSA-0001' }, { ...row('MOSA-0002'), finished: 'true' }], [tile('MOSA-0001', 'MOSA-0002')])).toEqual([]);
  });

  it('a collection\'s tile stands for each of its mosaics', () => {
    expect(doneMosaics([row('MOSA-0002', true)], [tile('MOSA-0001', 'MOSA-0002')])).toEqual(['MOSA-0002']);
  });
});

describe('mosaics in play', () => {
  it('are the mosaics the tiles stand for with a row, and not finished', () => {
    const rows = [row('MOSA-0001'), row('MOSA-0002'), row('MOSA-0003', true), row('MOSA-0004')];
    expect(playingMosaics(rows, [tile('MOSA-0001'), tile('MOSA-0002'), tile('MOSA-0003')], ['MOSA-0003'])).toEqual(['MOSA-0001', 'MOSA-0002']);
  });
});

describe('a finished mosaic\'s name', () => {
  const opened = name => ({ status: 'fulfilled', value: { name } });

  it('is read from its file, by hidden ID', () => {
    expect(mosaicNames(['MOSA-0001', 'MOSA-0003'], [opened('Barn Owl'), opened('Robot 20')])).toEqual({ 'MOSA-0001': 'Barn Owl', 'MOSA-0003': 'Robot 20' });
  });

  it('a file that couldn\'t be opened names nothing', () => {
    expect(mosaicNames(['MOSA-0001', 'MOSA-0003'], [{ status: 'rejected', reason: new Error('gone') }, opened('Robot 20')])).toEqual({ 'MOSA-0003': 'Robot 20' });
  });

  it('none finished, none named', () => {
    expect(mosaicNames([], [])).toEqual({});
  });
});
