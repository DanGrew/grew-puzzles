import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

// The schemas hold shape only; checks 1–10 hold the rules. Every fixture — failing ones
// included — must be schema-valid, so each fixture fails on its check, not on its shape.

const ROOT = path.resolve(__dirname, '../..');
const readJSON = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const compile = name => new Ajv({ allErrors: true }).compile(readJSON(`schemas/${name}.schema.json`));
const puzzleSchema = compile('puzzle');
const fixtureNames = fs.readdirSync(path.join(ROOT, 'tests/fixtures/puzzles'));

describe('puzzle schema', () => {
  it.each(fixtureNames)('accepts the fixture %s', name => {
    expect(puzzleSchema(readJSON(`tests/fixtures/puzzles/${name}`))).toBe(true);
  });

  it('rejects an unknown direction, a malformed hidden ID and a missing title', () => {
    const valid = readJSON('tests/fixtures/puzzles/valid.json');
    expect(puzzleSchema({ ...valid, words: [{ ...valid.words[0], direction: 'UP' }] })).toBe(false);
    expect(puzzleSchema({ ...valid, hiddenId: 'WS-1' })).toBe(false);
    const { title, ...untitled } = valid;
    expect(puzzleSchema(untitled)).toBe(false);
  });
});

describe('manifest and collection index schemas', () => {
  it('accept the fixture tree and the published puzzles/ tree', () => {
    const manifest = compile('manifest');
    const collections = compile('collections');
    expect(manifest(readJSON('tests/fixtures/tree/vanilla/manifest.json'))).toBe(true);
    expect(collections(readJSON('tests/fixtures/tree/collections.json'))).toBe(true);
    expect(manifest(readJSON('puzzles/vanilla/manifest.json'))).toBe(true);
    expect(collections(readJSON('puzzles/collections.json'))).toBe(true);
  });

  it('reject a manifest entry whose file is not a numbered puzzle file', () => {
    const manifest = compile('manifest');
    expect(manifest({ collection: 'vanilla', name: 'Vanilla', puzzles: [{ publicId: 1, title: 'Farmyard', file: 'farmyard.json' }] })).toBe(false);
  });
});
