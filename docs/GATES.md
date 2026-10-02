# Gates

Every pull request runs `.github/workflows/test.yml`; nothing runs on `main`. The set mirrors
`homeschooling-app`'s, minus its content-specific gates and minus `no-json-in-repo` — puzzles
are JSON.

| job | what it checks |
|---|---|
| `coverage` | the vitest unit suite with v8 coverage over `core/**/*-core.js`, floors in `vitest.config.js` |
| `check-untested` | every `core/` file is referenced by a `tests/unit` test |
| `e2e-test` | the Playwright suite under `tests/` (excluding `tests/unit`) |
| `ui-cyclomatic` | inline page scripts and `ui/` stay at complexity 1 — only files this PR touches block |
| `validate-json` | every JSON content file against its schema — mappings in `scripts/validate-schemas.js` |
| arch checks | `scripts/arch-check.js <rule>`: `no-dom-in-core` · `no-ui-imports` · `no-stray-files` · `no-app-exports` · `app-index-only` · `no-media-outside-assets` · `no-css-outside-styles` · `no-md-outside-docs` · `no-guard-chain` · `no-filter-conditional` · `no-pure-fn-outside-core` · `no-logic-in-inline-callbacks` |

`pr-report` gathers every result into one PR comment. Each gate passes on an empty layer, so it
runs from the first commit rather than switching on later.

## Locally

- `npm install` once — it also points git at `.githooks/`, whose `pre-push` runs the arch checks,
  `validate-json`, `ui-cyclomatic`, `check-untested` and the unit suite. e2e is CI's job.
- `claude-workflow/tools/checks-local.py <worktree>` runs the whole workflow before a push — it
  reads `test.yml`, so a new job is picked up without touching the tool.

## Mutation — local, on demand, never in CI

`npm run test:mutation` runs StrykerJS over `core/**/*-core.js` (`stryker.config.mjs`). The bar is
100%: a survivor is resolved by a test, a deletion or a restructure, never called equivalent. The
owner runs it when they choose, usually through `claude-workflow/tools/mutation-all`. Do not add a
mutation workflow.

**Refs:** `../.github/workflows/test.yml` · `../stryker.config.mjs`
