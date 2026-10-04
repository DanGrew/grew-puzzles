// The browse grid's rules: which tiles show — every puzzle once, and every collection as a tile of
// its own — their order and paging, what each tile, filter and pager button says, and how the
// filter and sort ride in the page address. Reads only the indexes' entries — never a puzzle file.
import { dayLabel } from './day-core.js';

export const PER_PAGE = 24;

// The filter that shows only collection tiles; a collection sorts by type as COLLECTION_TYPE.
export const COLLECTIONS = 'Collections';
export const COLLECTION_TYPE = 'Collection';

function idNumber(hiddenId) {
  return Number(hiddenId.split('-')[1]);
}

// Newest first: by created date, then — the same day — the later hidden ID, a puzzle before a
// collection, and two collections by name.
function newer(a, b) {
  return b.created.localeCompare(a.created) || b.rank - a.rank || a.title.localeCompare(b.title);
}

// Every type at least one puzzle has, once each, A to Z — never a hand-kept list.
export function typesOf(puzzles) {
  return [...new Set(puzzles.map(p => p.type))].sort();
}

// The filters an address may pick: Collections first while a collection exists, then each
// puzzle type.
export function filterOptions(puzzles, collections) {
  return [...(collections.length > 0 ? [COLLECTIONS] : []), ...typesOf(puzzles)];
}

// How hard each type is — the one place it is written. A tile's strip and the type's filter row
// both take their colour from it, a colour per difficulty in styles/browse.css. Vanilla, and any
// type not listed here, is Easy, so a new type never ships uncoloured.
export function difficultyOf(type) {
  const difficulty = new Map([
    ['Saga', 'Medium'], ['Wildcards', 'Medium'], ['Missing', 'Hard'], ['Repeats', 'Hard'], ['Mirra?e', 'Extreme'],
  ]);
  return difficulty.get(type) ?? 'Easy';
}

// The filter popup: a row per difficulty, Easy to Extreme, holding its types A to Z — a
// difficulty with none has no row — then Collections on a row of its own, with no name. Each
// row's tone names its colour.
export function filterRows(types) {
  const rowOf = type => (type === COLLECTIONS ? COLLECTION_TYPE : difficultyOf(type));
  const named = { [COLLECTION_TYPE]: '' };
  return ['Easy', 'Medium', 'Hard', 'Extreme', COLLECTION_TYPE]
    .map(tone => ({ name: named[tone] ?? tone, tone, types: types.filter(t => rowOf(t) === tone) }))
    .filter(row => row.types.length > 0);
}

// A filter shows pressed while every type it stands for is picked — one for a type, the whole
// row for a difficulty's name.
export function picked(state, types) {
  return String(types.every(t => state.types.includes(t)));
}

// Pressing a difficulty's name picks the rest of its row, or — all of it already picked —
// unpicks the row. Types in other rows never change.
export function toggleRow(state, row) {
  const all = picked(state, row) === 'true';
  const types = all ? state.types.filter(t => !row.includes(t)) : [...state.types, ...row.filter(t => !state.types.includes(t))];
  return { ...state, types };
}

// The Filters button counts the picks once there are any: "Filters · 2".
export function filtersLabel(state) {
  return ['Filters', ...(state.types.length > 0 ? [state.types.length] : [])].join(' · ');
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

// Every tile browse can show, as one list: a puzzle by its own title, type and date, in its
// difficulty's tone, and a collection by its name, as the type Collection, in the collections'
// tone, and its created date. A collection's puzzles are never tiles here — each puzzle shows
// once, however many collections hold it. ids are the puzzles a tile stands for — finished, all of
// them, it's ticked (core/wordsearch/done-core.js).
export function browseItems(puzzles, collections) {
  return [
    ...puzzles.map(p => ({
      ...p, kind: 'puzzle', filter: p.type, tone: difficultyOf(p.type), rank: idNumber(p.hiddenId), href: playHref(p.hiddenId),
      lines: tileDetail(p), ids: [p.hiddenId],
    })),
    ...collections.map(c => ({
      kind: 'collection', title: c.name, type: COLLECTION_TYPE, filter: COLLECTIONS, tone: COLLECTION_TYPE, created: c.created,
      rank: 0, href: collectionHref(c.slug), lines: [c.description, typeBreakdown(c, puzzles)], ids: c.puzzles.map(({ id }) => id),
    })),
  ];
}

// The filter and sort a page address asks for. A filter the page doesn't offer, or a sort or
// direction it doesn't have, falls back as if it were never asked: everything, date, newest first.
export function browseState(search, types) {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  return {
    types: types.filter(t => params.getAll('type').includes(t)),
    sort: ['title', 'type'].includes(sort) ? sort : 'date',
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
  };
}

// The address's query for a state: each picked type, and the sort and direction only when they
// aren't the default — so the plain landing page keeps its plain address.
export function browseSearch(state) {
  const params = new URLSearchParams();
  state.types.forEach(t => params.append('type', t));
  if (state.sort !== 'date') params.set('sort', state.sort);
  if (state.dir !== 'desc') params.set('dir', state.dir);
  const query = params.toString();
  return query ? `?${query}` : '';
}

// The tiles a state shows, in its order. No filter picked shows every tile; picked filters widen,
// since a tile matches exactly one — its puzzle's type, or Collections. Ties fall back to newest
// first, whichever way the sort runs.
export function browseList(items, state) {
  const keys = { date: p => p.created, title: p => p.title, type: p => p.type };
  const key = keys[state.sort];
  const sign = state.dir === 'asc' ? 1 : -1;
  return items
    .filter(p => state.types.length === 0 || state.types.includes(p.filter))
    .sort((a, b) => sign * key(a).localeCompare(key(b)) || newer(a, b));
}

export function pageCount(total) {
  return Math.max(1, Math.ceil(total / PER_PAGE));
}

export function pageOf(list, page) {
  return list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
}

// Picking a type adds it; picking it again takes it away.
export function toggleType(state, type) {
  const types = state.types.includes(type) ? state.types.filter(t => t !== type) : [...state.types, type];
  return { ...state, types };
}

export function clearTypes(state) {
  return { ...state, types: [] };
}

export function noTypesPicked(state) {
  return state.types.length === 0;
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
    date: { desc: 'Newest first', asc: 'Oldest first' },
    title: { asc: 'A to Z', desc: 'Z to A' },
    type: { asc: 'A to Z', desc: 'Z to A' },
  };
  return labels[state.sort][state.dir];
}

// The small lines beneath a tile's title: its type as written, then its created date — a line
// each, so a long date never wraps one tile taller than the rest.
export function tileDetail(puzzle) {
  return [puzzle.type, dayLabel(puzzle.created)];
}

export function playHref(hiddenId) {
  return `play.html?id=${encodeURIComponent(hiddenId)}`;
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
