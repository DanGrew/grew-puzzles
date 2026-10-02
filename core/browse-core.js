// The browse grid's rules: which collections show, the order and paging of their puzzles, and
// what each tile and pager button says. Reads only manifest entries — never a puzzle file.

export const PER_PAGE = 24;

// Collections that exist in the format but aren't on the site yet stay wired and hidden.
const SHOWN = ['vanilla'];

export function shownCollections(index) {
  return index.collections.filter(slug => SHOWN.includes(slug));
}

export function orderByPublicId(puzzles) {
  return [...puzzles].sort((a, b) => a.publicId - b.publicId);
}

export function pageCount(total) {
  return Math.max(1, Math.ceil(total / PER_PAGE));
}

export function pageOf(puzzles, page) {
  return orderByPublicId(puzzles).slice((page - 1) * PER_PAGE, page * PER_PAGE);
}

export function tileLabel(name, publicId) {
  return `${name} ${publicId}`;
}

export function playHref(collection, publicId) {
  return `play.html?collection=${encodeURIComponent(collection)}&id=${publicId}`;
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
