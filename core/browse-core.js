// The browse grid's rules: the order and paging of the puzzles, and what each tile and pager
// button says. Reads only the index's entries — never a puzzle file.
import { dayLabel } from './day-core.js';

export const PER_PAGE = 24;

function idNumber(hiddenId) {
  return Number(hiddenId.split('-')[1]);
}

// Newest first: by created date, then — saved the same day — by the later hidden ID.
export function newestFirst(puzzles) {
  return [...puzzles].sort((a, b) => b.created.localeCompare(a.created) || idNumber(b.hiddenId) - idNumber(a.hiddenId));
}

export function pageCount(total) {
  return Math.max(1, Math.ceil(total / PER_PAGE));
}

export function pageOf(puzzles, page) {
  return newestFirst(puzzles).slice((page - 1) * PER_PAGE, page * PER_PAGE);
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
