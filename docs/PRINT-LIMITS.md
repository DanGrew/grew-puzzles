# Print limits

What prints, and how big it can be, for each kind. A puzzle over its kind's limit plays on the
site alone: no print menu, no sheet, and left out of a collection's book.

## Paper

| what | size |
|---|---|
| a puzzle's printout | US Letter, 8.5×11 in, a 0.5 in edge kept inside the sheet |
| the book, Plain | 8.5×11 in, no margin — each page keeps its own 0.5 in edges |
| the book, Colour or Black and white | 8.625×11.25 in, KDP bleed — the trim and everything on it where the 8.5×11 in book has it |

## Limits by kind

| kind | prints when | the gate |
|---|---|---|
| Maze | exactly **32×40** — 0.2 in a cell, 6.4 × 8 in on the page | `core/maze/play-core.js` `mazePrints` |
| Minesweeper | **30 squares or fewer** along its longer side — that side 7.2 in on the page | `core/minesweeper/play-core.js` `minesPrints` |
| Criss-cross | **25 squares or fewer** a side, **and** its list in **36 lines or fewer** — a line a word, plus one heading for each word length | `core/crisscross/play-core.js` `crissPrints` |
| Wordsearch | **any size** — no gate; the grid shrinks to fit, down to a floor | — |

In a book, a bigger maze is never fetched; a bigger board or criss-cross is fetched, left out,
and named on screen (`Puzzle 2 is too big to print, so it plays on the site only.`), never on
paper.

## Wordsearch sizing

`core/theme-core.js` `printCell` sizes a printed cell:

- a cell is 14 pt at the least, 36 px at the most;
- the grid is never wider than 7.5 in, and with big letters (Kids) no wider than the words
  card's 165 mm unless a Vanilla's already is;
- a one-grid sheet leaves its grid 105 mm down, a Saga's grid sheet 200 mm;
- grid letters never go under 7 pt (`styles/play.css`).

Nothing stops a wordsearch past that floor, so a very big one runs off its sheet rather than
being refused: roughly past **38 columns**, or about **21 rows** on a one-grid sheet (about 40
on a Saga's grid sheet). The 15×15 default is well inside.

## Changing a limit

A limit is the owner's call — mazes 2026-10-08, minesweeper and criss-cross 2026-10-11. Change
the gate above and its unit test, then the book follows, since `core/book-core.js` asks the same
gates.
