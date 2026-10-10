// The browse grid's rules: which tiles show — a kind's puzzles, each once, or every collection as a
// tile of its own — their order and paging, what each tile, filter and pager button says, and how
// the place, filter and sort ride in the page address — and the Continue playing rail above them,
// a set at a time. Reads only the indexes' entries — never a puzzle file.
import { dayLabel } from './day-core.js';
import { tileDone } from './wordsearch/done-core.js';
import { COLLECTIONS, kinds, kindOf, places, difficulties, puzzleDifficulty, levelsOf, typesOf, placeParams } from './kind-core.js';

export const PER_PAGE = 24;

// A collection tile's type and tone: it sorts by type as COLLECTION_TYPE.
export const COLLECTION_TYPE = 'Collection';

function idNumber(hiddenId) {
  return Number(hiddenId.split('-')[1]);
}

// Newest first: by created date, then — the same day — the later hidden ID, and two collections by
// name.
function newer(a, b) {
  return b.created.localeCompare(a.created) || b.rank - a.rank || a.title.localeCompare(b.title);
}

// What each place's filters offer: the difficulties its puzzles have and its kind's own types, and
// neither for Collections.
export function filterOptions(puzzles) {
  return Object.fromEntries(places().map(place => [place, { levels: levelsOf(place, puzzles), types: typesOf(place, puzzles) }]));
}

// Whether a place has nothing to filter: no types, and — nobody signed in — no Finished row.
export function noFilters(types, signedIn) {
  return types.length === 0 && !signedIn;
}

// Every tone, easiest first, then collections: the Difficulty sort's order.
function tones() {
  return [...difficulties(), COLLECTION_TYPE];
}

// The filter popup, the same for every kind: a Difficulty row, Easy to Extreme, each in its colour,
// then a Type row, the kind's types in one list — a row with nothing to pick isn't there. A pick
// names what it picks from (levels or types) and what.
export function filterRows(options) {
  return [
    { name: 'Difficulty', picks: options.levels.map(level => ({ key: 'levels', value: level, tone: level })) },
    { name: 'Type', picks: options.types.map(type => ({ key: 'types', value: type, tone: '' })) },
  ].filter(row => row.picks.length > 0);
}

// A pick shows pressed while it is picked.
export function picked(state, pick) {
  return String(state[pick.key].includes(pick.value));
}

// Pressing a pick adds it, or — picked already — takes it away; the other row never changes.
export function togglePick(state, pick) {
  const list = state[pick.key];
  return { ...state, [pick.key]: list.includes(pick.value) ? list.filter(v => v !== pick.value) : [...list, pick.value] };
}

// The Filters button counts the picks once there are any, a Finished choice among them: "Filters · 2".
export function filtersLabel(state) {
  const count = state.levels.length + state.types.length + Number(state.finished !== '');
  return ['Filters', ...(count > 0 ? [count] : [])].join(' · ');
}

// The Finished row's two choices — finished, the ✓ tiles, or not — at most one picked. Picking the
// other swaps them; picking the picked one again unpicks it.
export function toggleFinished(state, choice) {
  return { ...state, finished: state.finished === choice ? '' : choice };
}

export function finishedPressed(state, choice) {
  return String(state.finished === choice);
}

// Whether the tiles shown hang on the player's progress — a Finished choice is picked — so the
// grid waits for it, and draws again whenever it changes.
export function filtersByProgress(state) {
  return String(state.finished !== '');
}

// Finished is a question about whoever is signed in: signed out, any choice is dropped.
export function withSignIn(state, signedIn) {
  return signedIn ? state : { ...state, finished: '' };
}

// How many of each type a collection holds, most first, ties A to Z: "8 Vanilla · 2 Missing".
export function typeBreakdown(collection, puzzles) {
  const typeOf = new Map(puzzles.map(p => [p.hiddenId, p.type]));
  const counts = new Map();
  collection.puzzles.map(({ id }) => typeOf.get(id)).forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1));
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, n]) => `${n} ${type}`)
    .join(' · ');
}

export function collectionHref(slug) {
  return `collection.html?slug=${encodeURIComponent(slug)}`;
}

// Every tile browse can show, as one list: a puzzle in its kind's place, by its own title, type
// and date, in its own difficulty's tone (puzzleDifficulty), and a collection in Collections, by its name, as the type
// Collection, in the collections' tone, and its created date. A collection's puzzles are never
// tiles there — each puzzle shows once, in its kind, however many collections hold it. ids are the
// puzzles a tile stands for — finished, all of them, it's ticked (core/wordsearch/done-core.js).
export function browseItems(puzzles, collections) {
  return [
    ...puzzles.map(p => ({
      ...p, kind: 'puzzle', place: kindOf(p.hiddenId), tone: puzzleDifficulty(p), rank: idNumber(p.hiddenId),
      href: playHref(p.hiddenId), lines: tileDetail(p), ids: [p.hiddenId],
    })),
    ...collections.map(c => ({
      kind: 'collection', place: COLLECTIONS, title: c.name, type: COLLECTION_TYPE, tone: COLLECTION_TYPE, created: c.created,
      rank: 0, href: collectionHref(c.slug), lines: [c.description, typeBreakdown(c, puzzles)], ids: c.puzzles.map(({ id }) => id),
    })),
  ];
}

// The place, filter and sort a page address asks for. A place the site doesn't have is the first,
// Wordsearches; a difficulty or type the place doesn't offer, or a sort or direction the page
// doesn't have, falls back as if it were never asked: everything, difficulty, easiest first.
// options are each place's difficulties and types (filterOptions). A Finished choice — finished=yes or finished=no — holds only once someone
// is found signed in.
export function browseState(search, options) {
  const params = new URLSearchParams(search);
  const kind = places().find(p => p === params.get('kind')) ?? places()[0];
  const sort = params.get('sort');
  const finished = params.get('finished');
  return {
    kind,
    levels: options[kind].levels.filter(l => params.getAll('difficulty').includes(l)),
    types: options[kind].types.filter(t => params.getAll('type').includes(t)),
    finished: ['yes', 'no'].includes(finished) ? finished : '',
    sort: ['date', 'title', 'type'].includes(sort) ? sort : 'difficulty',
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
  };
}

// The address's query for a state: the place, each picked type, each picked difficulty, a Finished
// choice, and the sort and direction only when they aren't the default — so the plain landing page
// keeps its plain address.
export function browseSearch(state) {
  const params = placeParams(state.kind, state.types);
  state.levels.forEach(l => params.append('difficulty', l));
  if (state.finished !== '') params.set('finished', state.finished);
  if (state.sort !== 'difficulty') params.set('sort', state.sort);
  if (state.dir !== 'desc') params.set('dir', state.dir);
  const query = params.toString();
  return query ? `?${query}` : '';
}

// The tiles a state shows, in its order: only its place's. Within a row picks widen, since a tile
// has exactly one difficulty and one type; the two rows narrow each other, and a row with nothing
// picked holds back nothing — so Hard and Vanilla is the Hard Vanilla tiles. A Finished choice
// narrows whatever the types show to the tiles wearing a ✓ — or not — for the puzzles done so far:
// it's a question about the player, not the puzzle. Ties fall back to newest first, whichever way
// the sort runs.
export function browseList(items, state, done) {
  const [first, ...within] = sortOrder(state.sort);
  const sign = state.dir === 'asc' ? 1 : -1;
  const finished = { '': () => true, yes: p => tileDone(p, done), no: p => !tileDone(p, done) }[state.finished];
  return items
    .filter(p => p.place === state.kind)
    .filter(p => inPicks(p, state))
    .filter(finished)
    .sort((a, b) => within.reduce((d, order) => d || order(a, b), sign * first(a, b)) || newer(a, b));
}

// Whether a tile is among the Difficulty and Type picks — the browse grid's and the rail's alike.
function inPicks(p, state) {
  return (state.levels.length === 0 || state.levels.includes(p.tone)) &&
    (state.types.length === 0 || state.types.includes(p.type));
}

// A sort's order: its first key runs the way the direction does, and any after it hold A to Z
// either way. Difficulty runs Easy to Extreme, then collections — the filter rows' order — as the
// default direction, desc, so the plain landing page is easiest first; within a difficulty, type
// then title.
function sortOrder(sort) {
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const byType = (a, b) => a.type.localeCompare(b.type);
  const orders = {
    difficulty: [(a, b) => tones().indexOf(b.tone) - tones().indexOf(a.tone), byType, byTitle],
    date: [(a, b) => a.created.localeCompare(b.created)],
    title: [byTitle],
    type: [byType],
  };
  return orders[sort];
}

export function pageCount(total) {
  return Math.max(1, Math.ceil(total / PER_PAGE));
}

export function pageOf(list, page) {
  return list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
}

// Clear filters unpicks the difficulties, the types and any Finished choice, keeping the sort.
export function clearFilters(state) {
  return { ...state, levels: [], types: [], finished: '' };
}

export function nothingPicked(state) {
  return state.levels.length === 0 && state.types.length === 0 && state.finished === '';
}

export function withSort(state, sort) {
  return { ...state, sort };
}

export function flipDir(state) {
  return { ...state, dir: { asc: 'desc', desc: 'asc' }[state.dir] };
}

// The direction button reads in the sort's own terms.
export function dirLabel(state) {
  const labels = {
    difficulty: { desc: 'Easiest first', asc: 'Hardest first' },
    date: { desc: 'Newest first', asc: 'Oldest first' },
    title: { asc: 'A to Z', desc: 'Z to A' },
    type: { asc: 'A to Z', desc: 'Z to A' },
  };
  return labels[state.sort][state.dir];
}

// The small lines beneath a tile's title: its type as written, then — a maze whose index entry
// has it — its size, width by height, then its created date — a line each, so a long date never
// wraps one tile taller than the rest.
export function tileDetail(puzzle) {
  const size = [puzzle].filter(p => p.width && p.height).map(p => `${p.width}×${p.height}`);
  return [puzzle.type, ...size, dayLabel(puzzle.created)];
}

// A puzzle's play page, its kind's: a maze plays on its own page, a wordsearch on the play page.
export function playHref(hiddenId) {
  const page = kinds().find(k => k.kind === kindOf(hiddenId)).page;
  return `${page}?id=${encodeURIComponent(hiddenId)}`;
}

function counted(n, word) {
  return n === 1 ? `1 ${word}` : `${n} ${word}s`;
}

// What the tiles shown add up to: the puzzles, then the collections once any show — "0 puzzles"
// when nothing does.
export function totalLabel(items) {
  const collections = items.filter(i => i.kind === 'collection').length;
  const puzzles = items.length - collections;
  const parts = [[puzzles, 'puzzle'], [collections, 'collection']].filter(([n]) => n > 0);
  return parts.map(([n, word]) => counted(n, word)).join(' · ') || counted(0, 'puzzle');
}

// The Continue playing rail's tiles: each puzzle in play's own browse tile, in the order given —
// a puzzle reached only through a collection still has one, opening it directly. Only a puzzle's
// tile carries a hidden ID, so a collection's is never picked. The rail follows what the grid is
// showing (the owner's calls, 2026-10-10): a kind's place only its own kind's puzzles, narrowed by
// the Difficulty and Type picks as the grid is; Collections, holding every kind, all of them. The
// Finished choice, sort and page never touch it — a puzzle in play is never finished.
export function railItems(items, playing, state) {
  const byId = new Map(items.map(i => [i.hiddenId, i]));
  return playing.map(id => byId.get(id))
    .filter(i => state.kind === COLLECTIONS || i.place === state.kind)
    .filter(i => inPicks(i, state));
}

// How many tiles fit across a grid: one per column the browser laid out for it.
export function columnsOf(template) {
  return template.split(' ').length;
}

// One set of the rail: as many tiles as fit across, the set asked for — or the last one, once
// fewer puzzles are in play or more fit — with ‹ only after the first set and › only before the
// last.
export function railView(list, set, fits) {
  const last = Math.max(0, Math.ceil(list.length / fits) - 1);
  const at = Math.min(set, last);
  return { set: at, tiles: list.slice(at * fits, (at + 1) * fits), prev: at > 0, next: at < last };
}

// One page needs no pager; more get previous, a button per page, then next.
export function pagerButtons(page, pages) {
  if (pages < 2) return [];
  const numbers = Array.from({ length: pages }, (_, i) => ({
    label: String(i + 1),
    target: i + 1,
    aria: `Page ${i + 1}`,
    current: i + 1 === page ? 'page' : 'false',
    disabled: false,
  }));
  return [
    { label: '‹', target: page - 1, aria: 'Previous page', current: 'false', disabled: page === 1 },
    ...numbers,
    { label: '›', target: page + 1, aria: 'Next page', current: 'false', disabled: page === pages },
  ];
}
