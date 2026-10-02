import { describe, it, expect } from 'vitest';
import { buildCoverageOutcome } from '../../scripts/write-coverage-report.js';

describe('coverage report — missing data fallback', () => {
  it('fails the step when coverage-summary.json is missing', () => {
    const outcome = buildCoverageOutcome(false, null, []);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.markdown).toContain('⚠️ Coverage data missing');
  });

  it('succeeds and renders the metrics table when coverage data is present', () => {
    const cov = {
      total: {
        lines: { pct: 87.5, covered: 7, total: 8 },
        statements: { pct: 87.5, covered: 7, total: 8 },
        functions: { pct: 100, covered: 2, total: 2 },
        branches: { pct: 75, covered: 3, total: 4 },
      },
    };
    const outcome = buildCoverageOutcome(true, cov, []);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.markdown).toContain('| Lines | 87.5% | 7 / 8 |');
  });

  it('lists per-file coverage for instrumented changed files', () => {
    const cwd = process.cwd();
    const cov = {
      total: {
        lines: { pct: 100, covered: 1, total: 1 },
        statements: { pct: 100, covered: 1, total: 1 },
        functions: { pct: 100, covered: 1, total: 1 },
        branches: { pct: 100, covered: 1, total: 1 },
      },
      [`${cwd}/core/example-core.js`]: {
        lines: { pct: 90 },
        functions: { pct: 80 },
      },
    };
    const outcome = buildCoverageOutcome(true, cov, ['core/example-core.js']);
    expect(outcome.markdown).toContain('`core/example-core.js` — lines: 90%, functions: 80%');
  });
});
