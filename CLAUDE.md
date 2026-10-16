# grew-puzzles — root index

The **public** site: Grew Puzzles, free puzzles with no ads and no paywalls; signing in, with
Google through Supabase, is optional and exists only to save progress. Served
as a static site from GitHub Pages at `https://dangrew.github.io/grew-puzzles/` — **no build
step**. Every generator and construction rule lives in the private `grew-puzzles-tooling` repo,
not here.

## ⛔ The site is dumb

| repo | visibility | holds |
|---|---|---|
| `grew-puzzles` (this one) | **public** | the pages, every puzzle file — each one already generated and validated — and the sign-in and save code with Supabase's public key |
| `grew-puzzles-tooling` | **private** | the generator, the word groups, every placement and construction rule, the puzzle format and its checks, and the Supabase database setup and its rules (its `docs/DATABASE.md`) |

- ⛔ This repo holds **puzzles and pages, nothing else**. No generation, word-group or placement logic ever ships here, not even as page code — a page only plays a puzzle that already exists.
- ⛔ Supabase's secret key never comes here — only its address and public (publishable) key, in `ui/sign-in-ui.js`, beside Google's client ID, public too. The database's own rules are what keep each player's progress theirs.
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
| `docs/PRINT-LIMITS.md` | the paper sizes, and how big each kind can be and still print | you're asking whether a puzzle will print, or changing a print limit |

## The shape of the site

GitHub Pages serves `main` root as-is — a merge to `main` is the deploy.

A row is a path and its purpose only — never what a task delivered; the code, the mockups and
the task's spec hold that.

| path | what it is |
|---|---|
| `index.html` | root redirect to `app/` |
| `app/index.html` | the landing page — browse by kind or by collection; after the product's `docs/MOCKUP-LANDING-BROWSE.html` |
| `app/collection.html` | a collection page — `collection.html?slug=<slug>`: one collection's puzzles, whatever their kind |
| `app/scorecard.html` | the Scorecard — every published puzzle, ticked once the signed-in player has finished it |
| `app/book.html` | a collection's book, its own KDP interior — `book.html?slug=<slug>&print=<style>`; after the product's `docs/MOCKUP-THEMED-PRINT.html` |
| `app/play.html` | the wordsearch play page — `play.html?id=<hidden ID>`; after the product's `docs/MOCKUP-PLAY-PAGE.html` |
| `app/maze.html` | the maze play page — `maze.html?id=<hidden ID>` |
| `app/minesweeper.html` | the minesweeper play page — `minesweeper.html?id=<hidden ID>`; after the product's `docs/MOCKUP-MINESWEEPER.html`, Reveal after `MOCKUP-MINES-REVEAL.html` |
| `app/crisscross.html` | the criss-cross play page — `crisscross.html?id=<hidden ID>`; after the product's `docs/MOCKUP-CRISS-CROSS.html` |
| `app/mosaic.html` | the mosaic play page — `mosaic.html?id=<hidden ID>`; after the product's `docs/MOCKUP-MOSAIC.html` |
| `app/about.html` | the About us page — the owner's words, from the product's `docs/CONTENT.md` |
| `app/unofficial.html` | the Unofficial page — the fan subjects the puzzles name; the owner's words from the product's `docs/CONTENT.md`, the rules the product's `docs/RIGHTS.md` |
| `app/feedback.html` | the Feedback page — the owner's words, from the product's `docs/CONTENT.md` |
| `app/how-to-play.html` | a kind's How to play page — `how-to-play.html?kind=<kind>`; its Rules from the product's `docs/RULES.md`, after that kind's `MOCKUP-RULES-<KIND>.html` |
| `app/saving.html` | the Saving your progress page — the owner's words, from the product's `docs/CONTENT.md` |
| `app/privacy.html` | the Privacy page — the owner's words, from the product's `docs/CONTENT.md` |
| Themed / Plain / Blueprint | the player's look, picked in every page's side bar and kept in the browser (`components/site-bar.js`) |
| Print: Colour / Black and white / Plain | how the printout and the book come out, picked from a printing page's print menu; after the product's `docs/MOCKUP-THEMED-PRINT.html` |
| `core/` | pure page logic, `*-core.js` ES modules, under the unit and mutation gates |
| `ui/` | each page's DOM code, ES modules importing `core/` |
| `vendor/supabase.js` | Supabase's browser library, copied in whole with its MIT licence; no page loads code from another site but Google's sign-in |
| `content/` | the site's data, the only place JSON lives (`no-json-in-repo`) — puzzles, collections and entries from tooling's publish, and the site's own characters |
| `components/site-bar.js` | the site bar and side bar every page shares; after the product's `docs/MOCKUP-KIND-LAYOUT.html`, Side bar with Tabs |
| `styles/*.css` | the Banded look — `theme.css` its tokens and difficulty colours, a sheet per page, `look.css` Themed's, `blueprint.css` Blueprint's |
| `tests/fixtures/` | test puzzles of every kind, made by tooling and passing its checks, and a test entries file — never on the site |
