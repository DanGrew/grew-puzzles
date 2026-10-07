# Gates

The gates are **local checks**: the `Tests` workflow is disabled on GitHub (Actions itself stays
on — Pages deploys through it).
`.github/workflows/test.yml` is the job list `checks-local` replays before a push — keep its
`pull_request` trigger, which is how that tool finds it.
The set mirrors `homeschooling-app`'s, minus its content-specific gates.

| job | what it checks |
|---|---|
| `puzzles` | every file in `content/` against the private `grew-puzzles-tooling` repo's checks, taken from its `origin/main` — `scripts/check-puzzles.sh`, which needs that clone beside the primary checkout — any worktree finds it from there. A failing puzzle names its file and check, and a broken collection fails it the same way, naming the collection; a check-10 warning prints and passes. The format and the ten checks are tooling's `docs/PUZZLE-FORMAT.md` |
| `coverage` | the vitest unit suite with v8 coverage over `core/**/*-core.js`, floors in `vitest.config.js` |
| `check-untested` | every `core/` file is referenced by a `tests/unit` test |
| `e2e-test` | the Playwright suite under `tests/` (excluding `tests/unit`) |
| `ui-cyclomatic` | inline page scripts and `ui/` stay at complexity 1 — only files this PR touches block |
| `validate-json` | every JSON content file against its schema — mappings in `scripts/validate-schemas.js` |
| arch checks | `scripts/arch-check.js <rule>`: `no-dom-in-core` · `no-ui-imports` · `no-stray-files` · `no-app-exports` · `app-index-only` · `no-media-outside-assets` · `no-json-in-repo` (JSON only in `content/`; `tests/` fixtures aside) · `no-css-outside-styles` · `no-md-outside-docs` · `no-guard-chain` · `no-filter-conditional` · `no-pure-fn-outside-core` · `no-logic-in-inline-callbacks` |

Each gate passes on an empty layer, so it runs from the first commit rather than switching on
later. `checks-local --post` puts the local verdict on the PR.

## Locally

- `npm install` once — it also points git at `.githooks/`, whose `pre-push` runs the arch checks,
  `validate-json`, `puzzles`, `ui-cyclomatic`, `check-untested` and the unit suite. e2e runs in
  `checks-local`, not the hook.
- `claude-workflow/tools/checks-local.py <worktree>` runs the whole workflow before a push — it
  reads `test.yml`, so a new job is picked up without touching the tool.
- Run directly, Playwright reuses whatever already serves its port (3000 unless `.port` or `PORT`
  says otherwise) — another worktree's server, its code not yours. Give a worktree its own
  port before running e2e there.

## Mutation — local, on demand

`npm run test:mutation` runs StrykerJS over `core/**/*-core.js` (`stryker.config.mjs`). The bar is
100%: a survivor is resolved by a test, a deletion or a restructure, never called equivalent.
The runner never reloads a module between mutants, so a mutant in code that runs at load can't
be killed by any test — keep `core/` free of load-time work: ES module exports (no
`typeof module` export guard), lookup tables inside the function that reads them, and unit
tests that build their fixtures per test, never at the top of the file. The
owner runs it when they choose, usually through `claude-workflow/tools/mutation-all`. Do not add a
mutation workflow.

**Refs:** `../.github/workflows/test.yml` · `../stryker.config.mjs`
