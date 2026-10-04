# Grew Puzzles

Free puzzles — no ads, no paywalls. Signing in, with Google, is optional and only ever saves
your progress. A static site on GitHub Pages at `https://dangrew.github.io/grew-puzzles/`.

This is the **public** repo: the pages, every puzzle they play, and the sign-in code with
Supabase's public key. Each puzzle was generated and checked before it got here — the site never
makes puzzles, it only shows them. The generator and its rules, and the database's rules, live in
a separate, private repo.

The first puzzle type is the wordsearch.

## Working on the site

There is no build step: the pages are plain HTML, CSS and JavaScript, served as they are.
`package.json` carries only the test tooling (vitest, Playwright, StrykerJS).

How to change it lives in `CLAUDE.md`, the index over this repo — start there rather than here.

## Licence

© 2026 Dan Grew. All rights reserved — the pages, the puzzles and the code are not licensed for
reuse. `vendor/` holds third-party code under its own licence, beside it.
