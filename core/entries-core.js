// A word's entry on the play page: where the entries live, which listed words have one, what its
// popup shows, and where the popup sits. Pure — the DOM work is ui/wordsearch/entry-ui.js. The
// entries file is grew-puzzles-tooling's docs/PUZZLE-FORMAT.md, "The word entries": one file,
// every entry by word group, and a word's entry is found through its puzzle's wordGroups.

export function entriesUrl() {
  return '../content/entries/index.json';
}

// A site with no entries has no entries file: every word is then as it always was.
export function entriesJson(response) {
  if (!response.ok) return { groups: [] };
  return response.json();
}

// One per listed word, in list order: marked when it has an entry, with what its popup shows. The
// puzzle's groups are searched in its own order — the group, then the word, exactly as listed — so
// a word in two of them takes its first group's entry. A word without one is left unmarked.
export function wordEntries(index, wordGroups, listed) {
  var entries = wordGroups.flatMap(function (slug) {
    var group = index.groups.find(function (g) { return g.group === slug; });
    return group ? group.entries : [];
  });
  return listed.map(function (word) {
    var entry = entries.find(function (e) { return e.word === word.text; });
    return entry ? entryView(entry) : unmarked(word.text);
  });
}

// The popup's parts: the word as its heading, its definition, a living thing's five facts,
// labelled, the text's credit, and the "read more" link. A part the entry hasn't got is left out.
function entryView(entry) {
  var facts = factRows(entry.facts || {});
  return {
    marked: true, word: entry.word, definition: entry.definition,
    facts: facts, hasFacts: facts.length > 0,
    credit: entry.credit || '', hasCredit: Boolean(entry.credit),
    link: entry.link || '', hasLink: Boolean(entry.link)
  };
}

function unmarked(text) {
  return { marked: false, word: text, definition: '', facts: [], hasFacts: false, credit: '', hasCredit: false, link: '', hasLink: false };
}

function factRows(facts) {
  var labels = { name: 'Name', habitat: 'Habitat', lifespan: 'Lifespan', food: 'Food', size: 'Size' };
  return Object.keys(labels).filter(function (key) { return Boolean(facts[key]); }).map(function (key) {
    return { label: labels[key], value: facts[key] };
  });
}

// Where the popup sits, in the screen's own px: beside the word — to its right, or to its left
// when the right hasn't the room — its top level with the word's, and never past the screen's
// edges. word is the word's box, popup the popup's size, view the screen's. On a phone the popup
// is a card over the page (styles/play.css), so it takes no place of its own.
export function popupPlace(word, popup, view, phone) {
  var gap = 10, edge = 8;
  if (phone) return { left: '', top: '' };
  var right = word.right + gap;
  var left = right + popup.width <= view.width - edge ? right : word.left - gap - popup.width;
  return {
    left: within(left, edge, view.width - popup.width - edge) + 'px',
    top: within(word.top, edge, view.height - popup.height - edge) + 'px'
  };
}

// at, kept between lo and hi; lo when the screen hasn't room for even that.
function within(at, lo, hi) {
  return Math.max(lo, Math.min(at, hi));
}

// A tap anywhere while the popup is open: inside it, or on a marked word — which swaps it — it
// does what it always does; anywhere else it only closes the popup, so it never lands on the grid.
export function popupTap(open, inside, onWord) {
  if (!open || inside || onWord) return 'none';
  return 'dismiss';
}

// Esc closes an open popup.
export function popupKey(open, key) {
  return open && key === 'Escape' ? 'close' : 'none';
}

// A marked word opens its popup from the keyboard as from a tap: Enter or Space.
export function wordKey(key) {
  return ['Enter', ' '].includes(key) ? 'open' : 'none';
}
