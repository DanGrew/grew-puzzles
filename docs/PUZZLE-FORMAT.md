# Puzzle format

The one shared reference for what a published puzzle is. The tooling repo's Save writes it, the
pages read it, and CI checks every puzzle against it. The solution sits in the file on purpose —
this repo is public, and the flip on the play page reads it.

## Where the files live

```
puzzles/
  collections.json        every collection, in the order the site lists them
  vanilla/
    manifest.json         the collection's puzzles: public ID, title, file
    0001.json             one file per puzzle, named by its public ID, 4 digits
    0002.json
```

The site can't list a directory, so the pages find everything through `collections.json` and
each `manifest.json`. A puzzle that isn't in its manifest isn't on the site, and CI fails it.

## The puzzle file

```json
{
  "hiddenId": "WSCH-0001",
  "collection": "vanilla",
  "publicId": 1,
  "title": "Farmyard",
  "wordGroups": ["farm-animals", "farm-places"],
  "words": [
    { "display": "Pig-pen", "start": { "row": 0, "col": 0 }, "direction": "E", "length": 6 },
    { "display": "Cat", "start": { "row": 1, "col": 0 }, "direction": "S", "length": 3 },
    { "display": "Cow", "start": { "row": 1, "col": 0 }, "direction": "E", "length": 3 },
    { "display": "Hen", "start": { "row": 1, "col": 5 }, "direction": "S", "length": 3 },
    { "display": "Ewe", "start": { "row": 2, "col": 5 }, "direction": "W", "length": 3 },
    { "display": "Dog", "start": { "row": 5, "col": 0 }, "direction": "E", "length": 3 }
  ],
  "grid": [
    "PIGPEN",
    "COWIAH",
    "APIEWE",
    "TIAPIN",
    "GAPIAD",
    "DOGAPI"
  ]
}
```

| field | holds |
|---|---|
| `hiddenId` | global ID, never shown to players: 4-letter type prefix + number, `WSCH-` for a wordsearch. Never changes once published |
| `collection` | the collection's slug — the same as its directory under `puzzles/` |
| `publicId` | the number players see, running 1, 2, 3… within the collection. Never changes once published |
| `title` | shown at the top of the play page and on the browse tile |
| `wordGroups` | the slugs of the tooling repo's word groups the words were drawn from |
| `words` | the word list, in the order players see it. `display` is the word as shown ("Ice cream"); the grid holds its normalised form — accents removed, spaces and hyphens stripped, uppercase (ICECREAM). `start` is the first letter's cell, `row` and `col` counted from 0 at the top left; `direction` is one of `N` `NE` `E` `SE` `S` `SW` `W` `NW`; `length` is the letter count in the grid |
| `grid` | the letters, one string per row, top to bottom |
| `fillPool` | *optional* — the letters filler may use, e.g. `"AEIOU"`. Left out, filler may use any letter from the placed words |

## The collection manifest

`puzzles/vanilla/manifest.json`:

```json
{
  "collection": "vanilla",
  "name": "Vanilla",
  "puzzles": [
    { "publicId": 1, "title": "Farmyard", "file": "0001.json" }
  ]
}
```

`name` is how the collection reads on a page ("Vanilla 7"). Each entry repeats the puzzle's public
ID and title so the browse page never opens a puzzle file — and so never touches a solution.

`puzzles/collections.json` names every collection directory: `{ "collections": ["vanilla"] }`.

## The play URL

```
https://dangrew.github.io/grew-puzzles/app/play.html?collection=vanilla&id=7
```

`collection` is the slug, `id` the public ID. The page opens `puzzles/<collection>/manifest.json`,
finds the entry with that public ID, and opens its file. The hidden ID is never in a URL and
never on a page.

## What CI checks

`tests/unit/puzzles.test.js` runs `core/puzzle-check-core.js` over everything under `puzzles/`.
Any failure fails the PR, naming the file and the check:

1. Every word in the list is placed in the grid.
2. Each word's letters sit in order along its line, matching its placement.
3. Every letter outside the words comes from the fill pool.
4. Every character in the grid is a capital A–Z, and every row is the same width.
5. Words overlap by one letter at most.
6. No word's placement sits inside another word's.
7. No word in the list is another one reversed.
8. Hidden IDs are unique across every collection; public IDs run 1, 2, 3… in each collection, with no gaps or duplicates.
9. Every puzzle has a title.
10. Each word appears only once in the grid — **a warning in the log, never a failure.** A copy inside another placed word (PIG inside PIGLET) isn't an accident and isn't counted.

The manifest and the files must also agree: every file is listed and every listed file exists,
the public IDs, titles and collection match, and `collections.json` names exactly the
collection directories. A palindrome (EWE) read forwards and backwards on the same cells is one
word, not two, for checks 7 and 10.

The shape — field names, types, directions — is `validate-json`'s, against `schemas/`. The
fixtures each check is proven against live in `tests/fixtures/`, never in `puzzles/`, so nothing
fake is published.

**Refs:** `../schemas/puzzle.schema.json` · `../schemas/manifest.schema.json` · `../core/puzzle-check-core.js`
