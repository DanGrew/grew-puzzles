// The collection book's rules: what its title page says, and which puzzle each page after it
// prints, in number order, headed with its number — the number its character goes by, as on the
// collection page. The pages themselves are the play page's
// printout (ui/wordsearch/play-ui.js drawSheet) — nothing here says how a puzzle looks. Nothing
// the book adds names a hidden ID or gives an answer: the answers stay on the site.
// The print styles a book or a puzzle's page prints in, as the side bar lists them: Colour, Black
// and white (mono), Plain.
export const PRINT_STYLES = ['colour', 'mono', 'plain'];

// The style a book's address asks for — Print book's choice on the collection page; Plain when
// it names none the site has.
export function printStyleOf(search) {
  const style = new URLSearchParams(search).get('print');
  return PRINT_STYLES.includes(style) ? style : 'plain';
}

export function bookView(collections, slug) {
  const collection = collections.find(c => c.slug === slug);
  const missing = { found: false, name: 'Collection not found', description: '', address: '', answers: '', back: '', pages: [] };
  return collection ? book(collection) : missing;
}

// Each puzzle's page numbers, in book order, given each one's board (play-core's playBoard): a
// puzzle prints one page, then a page more for each grid printed on a sheet of its own. The title
// page is page 1 and the copyright page 2, so the first puzzle starts on 3. Page 1 is a right-hand
// page, so every even number falls on the left, as KDP needs.
export function pageNumbers(boards) {
  let next = 3;
  return boards.map(board => Array.from({ length: 1 + board.sheets.length }, () => {
    const number = next++;
    return { number, side: number % 2 === 0 ? 'left' : 'right' };
  }));
}

// Only a wordsearch prints in the book. A maze is played on the site alone, and is left out: only
// a 32×40 maze will ever print, and none prints yet (TASK-88).
function prints(id) {
  return id.startsWith('WSCH-');
}

function book(collection) {
  const pages = collection.puzzles.filter(p => prints(p.id))
    .sort((a, b) => a.number - b.number)
    .map(({ id, number }) => ({ heading: `Puzzle ${number}`, number, search: `?id=${id}` }));
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
