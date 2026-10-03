// The browse grid's rules: which puzzles show, their order and paging, what each tile, filter
// and pager button says, and how the filter and sort ride in the page address. Reads only the
// index's entries — never a puzzle file.
import { dayLabel } from './day-core.js';

export const PER_PAGE = 24;

function idNumber(hiddenId) {
  return Number(hiddenId.split('-')[1]);
}

// Newest first: by created date, then — saved the same day — by the later hidden ID.
function newer(a, b) {
  return b.created.localeCompare(a.created) || idNumber(b.hiddenId) - idNumber(a.hiddenId);
}

// Every type at least one puzzle has, once each, A to Z — never a hand-kept list.
export function typesOf(puzzles) {
  return [...new Set(puzzles.map(p => p.type))].sort();
}

// The filter and sort a page address asks for. A type no puzzle has, or a sort or direction the
// page doesn't offer, falls back as if it were never asked: every type, date, newest first.
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

// The puzzles a state shows, in its order. No type picked shows every puzzle; picked types widen,
// since a puzzle has exactly one. Ties fall back to newest first, whichever way the sort runs.
export function browseList(puzzles, state) {
  const keys = { date: p => p.created, title: p => p.title, type: p => p.type };
  const key = keys[state.sort];
  const sign = state.dir === 'asc' ? 1 : -1;
  return puzzles
    .filter(p => state.types.length === 0 || state.types.includes(p.type))
    .sort((a, b) => sign * key(a).localeCompare(key(b)) || newer(a, b));
}

export function pageCount(total) {
  return Math.max(1, Math.ceil(total / PER_PAGE));
}

export function pageOf(list, page) {
  return list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
}

// A filter button per type, pressed when that type is picked.
export function filterChips(types, state) {
  return types.map(t => ({ label: t, pressed: String(state.types.includes(t)) }));
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

export function totalLabel(total) {
  return total === 1 ? '1 puzzle' : `${total} puzzles`;
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
