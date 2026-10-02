import { describe, it, expect } from 'vitest';
import path from 'path';
import { checkTree, formatFinding } from '../../core/puzzle-check-core.js';
import { loadPuzzleTree } from './load-puzzle-tree.js';

// The CI harness: every published puzzle under puzzles/ against the ten checks.
// Checks 1–9 and the manifest agreement fail the run, naming the file and the check;
// check 10 only prints a warning to the log.

describe('every published puzzle', () => {
  const { failures, warnings } = checkTree(loadPuzzleTree(path.resolve(__dirname, '../../puzzles')));

  it('passes checks 1–9, and its collection manifest agrees with it', () => {
    warnings.forEach(w => process.stderr.write(`⚠ warning ${formatFinding(w)}\n`));
    expect(failures.map(formatFinding)).toEqual([]);
  });
});

describe('loadPuzzleTree', () => {
  it('reads collections.json, each manifest and each puzzle file, by name', () => {
    const tree = loadPuzzleTree(path.resolve(__dirname, '../fixtures/tree'));
    expect(tree.index).toEqual({ collections: ['vanilla'] });
    expect(Object.keys(tree.collections)).toEqual(['vanilla']);
    expect(tree.collections.vanilla.manifest.name).toBe('Vanilla');
    expect(Object.keys(tree.collections.vanilla.files)).toEqual(['0001.json']);
    expect(tree.collections.vanilla.files['0001.json'].hiddenId).toBe('WSCH-0001');
    expect(checkTree(tree)).toEqual({ failures: [], warnings: [] });
  });
});
