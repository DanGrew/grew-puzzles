# grew-puzzles — root index

The **public** site: Grew Puzzles, free puzzles with no ads, no paywalls and no accounts. Served
as a static site from GitHub Pages at `https://dangrew.github.io/grew-puzzles/` — **no build
step**. Every generator and construction rule lives in the private `grew-puzzles-tooling` repo,
not here.

## ⛔ The site is dumb

| repo | visibility | holds |
|---|---|---|
| `grew-puzzles` (this one) | **public** | the pages, and every puzzle file — each one already generated and validated |
| `grew-puzzles-tooling` | **private** | the generator, the word groups, and every placement and construction rule |

- ⛔ This repo holds **puzzles and pages, nothing else**. No generation, word-group or placement logic ever ships here, not even as page code — a page only plays a puzzle that already exists.
- No puzzle format, schema or check lives here either: they're all in tooling. This repo's local checks run tooling's `origin/main` checks over `puzzles/` (`scripts/check-puzzles.sh`); the format is tooling's `docs/PUZZLE-FORMAT.md`.

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
| `app/index.html` | the landing page |
| `components/site-bar.js` | the site bar every page shares — fills `<header class="site" data-site-bar data-home data-current>` |
| `styles/theme.css` · `styles/site-bar.css` | the Banded tokens (light only), and the site bar's look |
