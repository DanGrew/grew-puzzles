// The site's kinds of puzzle — Wordsearches and Mazes — and the side bar that maps the site by
// them: which kind a puzzle is, how hard each kind's types are, and where each side bar entry goes.
// The kind is where the player is; the type is what they filter within it. A type is always taken
// with its kind — each kind has its own Vanilla. Collections is a place of its own, beside the
// kinds, holding every collection whatever its puzzles' kinds. Reads only the indexes' entries —
// never a puzzle file.

export const COLLECTIONS = 'collections';

// Every kind, in the side bar's order: its address name, what players call it, its hidden IDs'
// prefix, its play page, and whether its type sets a puzzle's difficulty — a wordsearch's does; a
// maze's difficulty is the owner's call on each maze, so a maze type has no one level.
export function kinds() {
  return [
    { kind: 'wordsearch', name: 'Wordsearches', prefix: 'WSCH', page: 'play.html', typeLevels: true },
    { kind: 'maze', name: 'Mazes', prefix: 'MAZE', page: 'maze.html', typeLevels: false },
  ];
}

// A puzzle's kind, by its hidden ID's prefix — a prefix no kind has is a wordsearch's.
export function kindOf(hiddenId) {
  const prefix = hiddenId.split('-')[0];
  return (kinds().find(k => k.prefix === prefix) ?? kinds()[0]).kind;
}

// The places browse can be: each kind, then Collections — the first is where the landing page opens.
export function places() {
  return [...kinds().map(k => k.kind), COLLECTIONS];
}

// What a place is called on the page.
export function placeName(place) {
  return new Map([...kinds().map(k => [k.kind, k.name]), [COLLECTIONS, 'Collections']]).get(place);
}

// How hard each kind's types are — the one place it is written. A wordsearch's tile strip and its
// type's side bar dot take their colour from it, a colour per difficulty in styles/theme.css; a
// maze's is only its level until the owner saves one of its own (puzzleDifficulty). Vanilla, and
// any type not listed here, is Easy, so a new type never ships uncoloured.
export function difficultyOf(kind, type) {
  const difficulty = new Map([
    ['wordsearch:Saga', 'Medium'], ['wordsearch:Wildcards', 'Medium'], ['wordsearch:Missing', 'Hard'],
    ['wordsearch:Repeats', 'Hard'], ['wordsearch:Mirra?e', 'Extreme'],
    ['maze:Collectibles', 'Medium'], ['maze:Code Breaker', 'Medium'], ['maze:Keys', 'Hard'], ['maze:Keylecticodes', 'Extreme'],
  ]);
  return difficulty.get(`${kind}:${type}`) ?? 'Easy';
}

// Every difficulty, easiest first: the Difficulty filter's order, and the Difficulty sort's.
export function difficulties() {
  return ['Easy', 'Medium', 'Hard', 'Extreme'];
}

// A puzzle's difficulty: the one the owner saved with it in its index entry, or — none saved, as
// every wordsearch and a maze saved before the pick — its type's.
export function puzzleDifficulty(puzzle) {
  return puzzle.difficulty ?? difficultyOf(kindOf(puzzle.hiddenId), puzzle.type);
}

// The difficulties a kind's puzzles have, easiest first.
export function levelsOf(kind, puzzles) {
  const held = puzzles.filter(p => kindOf(p.hiddenId) === kind).map(puzzleDifficulty);
  return difficulties().filter(d => held.includes(d));
}

// The types a kind's puzzles have, once each — never a hand-kept list — easiest first, A to Z
// within a difficulty.
export function typesOf(kind, puzzles) {
  const rank = type => difficulties().indexOf(difficultyOf(kind, type));
  return [...new Set(puzzles.filter(p => kindOf(p.hiddenId) === kind).map(p => p.type))]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// The address's part that says where browse is: the place — none for the first, where the landing
// page opens — then each picked type.
export function placeParams(place, types) {
  const params = new URLSearchParams();
  if (place !== places()[0]) params.set('kind', place);
  types.forEach(t => params.append('type', t));
  return params;
}

function query(params) {
  const text = params.toString();
  return text ? `?${text}` : '';
}

// The dot beside a type in the side bar, in its difficulty's tone — only where the type sets the
// difficulty, so a maze type has none.
function typeDots(kind, type) {
  return kinds().filter(k => k.kind === kind && k.typeLevels).map(() => difficultyOf(kind, type));
}

// The side bar's map of the site: each kind with its puzzle count, then its types, each with its
// dot, opening that kind filtered to that type alone; then Collections, with its count, shown only
// while a collection exists. Each entry's mark is what it's current for.
export function sideBar(puzzles, collections) {
  return {
    kinds: kinds().map(k => ({
      mark: k.kind, name: k.name, count: String(puzzles.filter(p => kindOf(p.hiddenId) === k.kind).length),
      query: query(placeParams(k.kind, [])),
      types: typesOf(k.kind, puzzles).map(type => ({
        mark: `${k.kind}:${type}`, name: type, dots: typeDots(k.kind, type), query: query(placeParams(k.kind, [type])),
      })),
    })),
    collections: { count: String(collections.length), query: query(placeParams(COLLECTIONS, [])), hidden: collections.length === 0 },
  };
}

// What a page is current for: its place, and — with one type picked there — that type too.
export function sideMarks(place, types) {
  return [place, ...types.filter(() => types.length === 1).map(t => `${place}:${t}`)];
}

// An entry's aria-current: the page it's current for, or not.
export function markOf(marks, mark) {
  return marks.includes(mark) ? 'page' : 'false';
}
