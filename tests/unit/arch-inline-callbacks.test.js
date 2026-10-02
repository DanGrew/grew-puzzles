import { describe, it, expect } from 'vitest';
import { detectInlineCallbackViolations } from '../../scripts/arch-check.js';

function methods(script) {
  return detectInlineCallbackViolations(script).map(v => v.method);
}

describe('no-logic-in-inline-callbacks matcher', () => {
  it('flags a block-body callback with pure return logic', () => {
    const src = 'var out = items.map(function(m) { return {value: m.id, label: m.label}; });';
    expect(methods(src)).toEqual(['map']);
  });

  it('flags a block-body filter predicate with a comparison', () => {
    const src = 'var out = items.filter(function(m) { return m.val !== undefined; });';
    expect(methods(src)).toEqual(['filter']);
  });

  it('flags a block-body sort comparator with arithmetic', () => {
    const src = 'rows.sort(function(a, b) { return b.timestamp - a.timestamp; });';
    expect(methods(src)).toEqual(['sort']);
  });

  it('flags a block-body reduce with a computation token', () => {
    const src = 'var total = xs.reduce(function(acc, x) { acc = acc + x.n; return acc; }, 0);';
    expect(methods(src)).toEqual(['reduce']);
  });

  it('flags a block-body arrow callback', () => {
    const src = 'var out = items.map((m) => { return m.id * 2; });';
    expect(methods(src)).toEqual(['map']);
  });

  it('does NOT flag a DOM-touching callback', () => {
    const src = 'nodes.map(function(n) { n.classList.add("on"); return n; });';
    expect(methods(src)).toEqual([]);
  });

  it('does NOT flag an expression-body arrow', () => {
    const src = 'var ids = items.map(m => m.id);';
    expect(methods(src)).toEqual([]);
  });

  it('does NOT flag a numeric expression-body sort comparator', () => {
    const src = 'nums.sort((a, b) => a - b);';
    expect(methods(src)).toEqual([]);
  });

  it('does NOT flag a callback passed by name (out of scope)', () => {
    const src = 'var out = items.map(formatItem);';
    expect(methods(src)).toEqual([]);
  });

  it('does NOT flag a named function declaration (out of scope of this rule)', () => {
    const src = 'function formatItem(m) { return {value: m.id}; }';
    expect(methods(src)).toEqual([]);
  });

  it('does NOT flag forEach (not a transform method)', () => {
    const src = 'items.forEach(function(m) { return m.id + 1; });';
    expect(methods(src)).toEqual([]);
  });

  it('reports the line of the flagged callback', () => {
    const src = 'var a = 1;\nvar b = 2;\nvar out = items.map(function(m) { return m.id + 1; });';
    expect(detectInlineCallbackViolations(src)[0].line).toBe(3);
  });

  it('flags multiple violations across a block', () => {
    const src = [
      'var tags = meta.filter(function(m) { return m.val !== undefined; })',
      '  .map(function(m) { return m.label + ": " + m.val; });'
    ].join('\n');
    expect(methods(src).sort()).toEqual(['filter', 'map']);
  });
});
