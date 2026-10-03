# grew-puzzles — root index

The **public** site: Grew Puzzles, free puzzles with no ads, no paywalls and no accounts. Served
as a static site from GitHub Pages at `https://dangrew.github.io/grew-puzzles/` — **no build
step**. Every generator and construction rule lives in the private `grew-puzzles-tooling` repo,
not here.

## ⛔ The site is dumb

| repo | visibility | holds |
|---|---|---|
| `grew-puzzles` (this one) | **public** | the pages, and every puzzle file — each one already generated and validated |
| `grew-puzzles-tooling` | **private** | the generator, the word groups, every placement and construction rule, and the puzzle format and its checks |

- ⛔ This repo holds **puzzles and pages, nothing else**. No generation, word-group or placement logic ever ships here, not even as page code — a page only plays a puzzle that already exists.
- No puzzle format, schema or check lives here either: they're all in tooling. This repo's local checks run tooling's `origin/main` checks over `content/` (`scripts/check-puzzles.sh`); the format is tooling's `docs/PUZZLE-FORMAT.md`.

## Before you implement

- **Work in a worktree off `origin/main`** — never branch-switch the primary checkout.

Process rules are **claude-workflow**'s, not this repo's:

- The product entry — ask `claude-config/bin/grew-product-dir grew-puzzles` where it lives, never assemble the path — holds the board, the specs and this product's deltas.

## Start here

Root holds only this file and `README.md`; everything else is `docs/`, flat, area in the name.

| name | what it holds | read it when |
|---|---|---|
| `README.md` | what the site is, for a human arriving cold | you're new here, or explaining it to someone |
| `docs/GATES.md` | every local gate, including the puzzle check, the pre-push hook and the on-demand mutation sweep | before pushing, or a gate went red |

## The shape of the site

GitHub Pages serves `main` root as-is — a merge to `main` is the deploy.

| path | what it is |
|---|---|
| `index.html` | root redirect to `app/` |
| `app/index.html` | the landing page — the browse grid, filtered by type and sorted by date, title or type (newest first by default), the filter and sort held in the address (`?type=…&sort=…&dir=…`), read from `content/puzzles/wordsearch/index.json` alone, never a puzzle file |
| `app/play.html` | the play page — `play.html?id=<hidden ID>`, which opens `content/puzzles/wordsearch/<hidden ID>.json`; the play URL in tooling's `docs/PUZZLE-FORMAT.md` |
| `core/` | pure page logic, `*-core.js` ES modules, under the unit and mutation gates — `core/browse-core.js` is the browse grid's rules, `core/wordsearch/play-core.js` the play page's, `core/day-core.js` how both show a created date |
| `ui/` | each page's DOM code, ES modules importing `core/` — `ui/wordsearch/play-ui.js` draws and wires the play page |
| `content/` | the site's data, apart from its code — the only place JSON lives (`no-json-in-repo`). The puzzles, by kind: `content/puzzles/<kind>/` holds `index.json` (every puzzle's hidden ID, type, created date and title) and one `<hidden ID>.json` per puzzle; the layout is tooling's `docs/PUZZLE-FORMAT.md` |
| `components/site-bar.js` | the site bar every page shares — fills `<header class="site" data-site-bar data-home data-current>` |
| `styles/theme.css` · `styles/site-bar.css` · `styles/browse.css` · `styles/play.css` | the Banded tokens (light only), the site bar's look, the browse grid's, and the play page's |
| `tests/fixtures/` | a test puzzle the e2e suite serves in place of a real one — never on the site |
