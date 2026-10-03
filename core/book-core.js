// The collection book's rules: what its title page says, and which puzzle each page after it
// prints, in number order, headed with its number. The pages themselves are the play page's
// printout (ui/wordsearch/play-ui.js drawSheet) — nothing here says how a puzzle looks. Nothing
// the book adds names a hidden ID or gives an answer: the answers stay on the site.
export function bookView(collections, slug) {
  const collection = collections.find(c => c.slug === slug);
  const missing = { found: false, name: 'Collection not found', description: '', address: '', answers: '', back: '', pages: [] };
  return collection ? book(collection) : missing;
}

function book(collection) {
  const pages = [...collection.puzzles]
    .sort((a, b) => a.number - b.number)
    .map(({ id, number }) => ({ heading: `Puzzle ${number}`, search: `?id=${id}` }));
  return {
    found: true,
    name: collection.name,
    description: collection.description,
    address: 'dangrew.github.io/grew-puzzles',
    answers: `The answers are on the site: open ${collection.name} in Collections, pick the puzzle's number, and flip its grid.`,
    back: `collection.html?slug=${encodeURIComponent(collection.slug)}`,
    pages,
  };
}
