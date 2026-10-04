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

## The shape of the site

GitHub Pages serves `main` root as-is — a merge to `main` is the deploy.

| path | what it is |
|---|---|
| `index.html` | root redirect to `app/` |
| `app/index.html` | the landing page — the browse grid: every puzzle once, and each collection as a tile of its own (name, description, type breakdown), filtered by type or Collections from a Filters popup — a row per difficulty, Easy to Extreme, a difficulty's name picking its whole row, Collections last — and sorted by date, title or type (newest first by default), the filter and sort held in the address (never a difficulty, never whether the popup is open) (`?type=…&sort=…&dir=…`, `?type=Collections` for collections alone), read from `content/puzzles/wordsearch/index.json` and `content/collections/index.json`, never a puzzle file |
| `app/collection.html` | a collection page — `collection.html?slug=<slug>`: its name and description, Print book, then its puzzles as tiles in number order, each marked with its number; no filter or sort |
| `app/book.html` | a collection's book — `book.html?slug=<slug>`, opened by Print book: a title page (name, description, the site's address, where the answers are), then each puzzle's own printout in number order, each of its pages headed Puzzle 1, Puzzle 2… — one page, or for a puzzle of several grids its words then a page per grid — and each puzzle starting a fresh page; the print dialog opens once every page is drawn. Each page is a copy of `play.html`'s own markup drawn by its `drawSheet`, so the printout and the book are one layout |
| `app/play.html` | the play page — `play.html?id=<hidden ID>`, which opens `content/puzzles/wordsearch/<hidden ID>.json`; the play URL in tooling's `docs/PUZZLE-FORMAT.md`. A puzzle of several grids (a Saga) shows them under tabs over its one word list, and prints its words on a sheet of their own, then each grid on its own. Where the words sit and the text size (Tiny to Huge, scaling the grid's letters and the words together, on screen only) are the player's, kept on the device. Signed in, every find is saved as a line as it's made, and the puzzle opens with them already drawn; signed out, nothing is saved and a quiet line under the words invites the player to sign in |
| `core/` | pure page logic, `*-core.js` ES modules, under the unit and mutation gates — `core/browse-core.js` is the browse grid's rules and each type's difficulty, the one place it is written, `core/collection-core.js` the collection page's, `core/book-core.js` the collection book's, `core/wordsearch/play-core.js` the play page's, `core/wordsearch/progress-core.js` saved progress's — a find is a line (page, start cell, direction), a line saved twice is one find, and when the line under the words shows the invitation or the not-saved note — `core/day-core.js` how every page shows a created date, `core/auth-core.js` sign-in's — the fingerprint of the one-time word that ties Google's answer to the page, and what the bar shows for them |
| `ui/` | each page's DOM code, ES modules importing `core/` — `ui/wordsearch/play-ui.js` draws and wires the play page, `ui/wordsearch/progress-ui.js` saves a signed-in player's finds through sign-in's client and reads them back before the grid draws, trying a failed save again until it lands, `ui/book-ui.js` puts the collection book together, `ui/sign-in-ui.js` is sign-in in every page's site bar: Sign in beside the burger (a figure, below 360px wide), opening a card with Google's own button, whose window opens over the page — the player never leaves it, and Supabase is handed Google's token; signed in the player's Google picture — their initial in a circle without one — opening a menu with their email and Sign out; it holds Supabase's address and public key, and Google's client ID, and its client is the page's one way to Supabase |
| `vendor/supabase.js` | Supabase's library, supabase-js 2.117.2's browser build (`dist/umd/supabase.js`), copied in whole with its MIT licence (`vendor/supabase-js-MIT-LICENSE`, which MIT requires travel with the copy — it covers that file alone; the site itself is all rights reserved, `README.md`) — no page loads code from another site, bar one: Google's sign-in script (`accounts.google.com/gsi/client`), fetched only once a player taps Sign in. Every page loads it, then `ui/sign-in-ui.js`. To update it, copy a newer release's same file over it; the arch checks pass over `vendor/` |
| `content/` | the site's data, apart from its code — the only place JSON lives (`no-json-in-repo`). The puzzles, by kind: `content/puzzles/<kind>/` holds `index.json` (every puzzle's hidden ID, type, created date and title) and one `<hidden ID>.json` per puzzle. `content/collections/index.json` holds every collection, written by tooling's publish, never by hand here. The layout is tooling's `docs/PUZZLE-FORMAT.md` |
| `components/site-bar.js` | the site bar every page shares — fills `<header class="site" data-site-bar data-home data-current>`; a page's own `[data-menu-entry]` children become its menu in place of the site's sections (the play page's How to play and Print). Its Collections entry starts hidden; a page that finds a collection shows it |
| `styles/theme.css` · `styles/site-bar.css` · `styles/browse.css` · `styles/play.css` · `styles/book.css` | the Banded tokens (light only), the site bar's look and its sign-in's, the browse grid's, its filter popup's and the collection page's — with each difficulty's colour, a line per difficulty, that tile strips and filter rows both read — the play page's — its `@media print` block is the printout, the one print layout — and the book's title page and number headings |
| `tests/fixtures/` | a test puzzle the e2e suite serves in place of a real one — never on the site |
