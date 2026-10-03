// The collection page's rules: which collection an address names, and what the page shows — its
// name and description, Print book, then its puzzles as tiles in number order, each marked with
// its number.
// Reads only the indexes' entries — never a puzzle file.
import { tileDetail, playHref } from './browse-core.js';

export function slugOf(search) {
  return new URLSearchParams(search).get('slug');
}

// The page a collection gets. Its order is always its numbers: there is no filter or sort here.
// An address naming no collection the site holds gets a page saying so, with no tiles.
export function collectionView(collections, puzzles, slug) {
  const collection = collections.find(c => c.slug === slug);
  const missing = { found: false, name: 'Collection not found', description: '', book: '', tiles: [] };
  return collection ? found(collection, puzzles) : missing;
}

function found(collection, puzzles) {
  const byId = new Map(puzzles.map(p => [p.hiddenId, p]));
  const tiles = [...collection.puzzles]
    .sort((a, b) => a.number - b.number)
    .map(({ id, number }) => ({
      number: String(number), title: byId.get(id).title, type: byId.get(id).type, lines: tileDetail(byId.get(id)),
      href: playHref(id),
    }));
  // Print book opens the whole collection as one printout (app/book.html).
  const book = `book.html?slug=${encodeURIComponent(collection.slug)}`;
  return { found: true, name: collection.name, description: collection.description, book, tiles };
}
