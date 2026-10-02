// StrykerJS mutation-testing gate for grew-puzzles, mirroring homeschooling-app's.
// Runs the Vitest unit suite against each mutant to prove the tests actually
// *catch* a regression, not merely execute the line. Coverage already enforces
// "executed" (vitest.config.js floors); this enforces "asserted".
//
// Scope is a DISCOVERY RULE, not an allowlist: mutate every `*-core.js` under
// core/ — the pure, DOM-free layer guarded by the `no-dom-in-core` arch gate,
// which is the ideal mutation target (deterministic, fast, no I/O). Adding a new
// core module puts it under the gate automatically. There are no exceptions
// today; any future `!`-exclusion must be STRUCTURAL (a file the tool cannot
// meaningfully analyse) and carry a one-line reason. Never convert this into a
// hand-maintained include-list of files to cover.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  // `related: false` — run the FULL vitest suite against every mutant. Vitest's
  // default "related" mode only runs tests whose module graph imports the
  // mutant; 30+ of the unit suites load their core via
  // `createRequire().require()` (CommonJS, untracked by Vitest's graph), so
  // related-mode would silently skip them and report those cores as uncovered.
  // Full-suite runs keep the gate honest.
  vitest: { configFile: 'vitest.config.js', related: false },
  coverageAnalysis: 'off',
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  mutate: ['core/**/*-core.js'],
  // Target 100%. `break: 100` means the run is RED until every mutant is killed.
  //
  // This gate runs LOCALLY ON DEMAND, never in CI — mutation is slow and CI
  // minutes are not spent on it (Grew-wide decision 2026-07-14; the sweep is
  // `claude-workflow/tools/mutation-all`). Do not add a `mutation.yml`. The bar
  // is unchanged by that: kill survivors with real tests, never lower this
  // threshold, never exclude an "equivalent" mutant to go green.
  thresholds: { high: 100, low: 100, break: 100 },
};
