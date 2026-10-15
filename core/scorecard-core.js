// The Scorecard's rules (app/scorecard.html, after the product's docs/MOCKUP-COMPLETION-LIST.html,
// Rows): every published puzzle as a line with a box, ticked once the signed-in player has finished
// it — the same finished-or-not the browse tiles show (core/wordsearch/done-core.js tileDone), never
// a rule of its own — grouped By kind, By type or By difficulty, each group counting what's
// finished. Reads only the indexes' entries — never a puzzle file — so a new kind joins it unchanged.
import { tileDone } from './wordsearch/done-core.js';
import { kinds, kindOf, difficulties, difficultyOf, puzzleDifficulty, typesOf } from './kind-core.js';
import { playHref } from './browse-core.js';

// How many lines a group shows before Show all.
export const SHOWN = 8;

// The tabs, By kind first — picked when the page opens.
export function tabs() {
  return [{ by: 'kind', label: 'By kind' }, { by: 'type', label: 'By type' }, { by: 'difficulty', label: 'By difficulty' }];
}

// Every puzzle as a line: its kind, type, difficulty, code and play page. ids is what ticks it —
// the puzzle alone, as its tile is.
export function scoreItems(puzzles) {
  return puzzles.map(p => ({
    hiddenId: p.hiddenId, title: p.title, type: p.type, created: p.created, kind: kindOf(p.hiddenId),
    tone: puzzleDifficulty(p), code: p.hiddenId, href: playHref(p.hiddenId), ids: [p.hiddenId],
  }));
}

// A group's lines run as browse's default sort (core/browse-core.js browseList): difficulty, Easy to
// Extreme then Kids, then type in the Filters' order, then title A to Z, the newest first on a tie —
// a difficulty's group, holding several kinds, takes them in the side bar's order before type (the
// owner's call, 2026-10-14).
function browseOrder(items) {
  const order = kinds().map(k => k.kind);
  const types = new Map(order.map(kind => [kind, typesOf(kind, items)]));
  const typeRank = i => types.get(i.kind).indexOf(i.type);
  return (a, b) => difficulties().indexOf(a.tone) - difficulties().indexOf(b.tone) ||
    order.indexOf(a.kind) - order.indexOf(b.kind) || typeRank(a) - typeRank(b) || a.title.localeCompare(b.title) ||
    b.created.localeCompare(a.created) || Number(b.hiddenId.split('-')[1]) - Number(a.hiddenId.split('-')[1]);
}

function kindName(kind, field) {
  return kinds().find(k => k.kind === kind)[field];
}

// What each grouping makes of the lines: its groups, in order — kinds in the side bar's, types in
// the Filters', difficulties Easy to Extreme then Kids — each with its heading, its heading's tone
// ('' is the band's green), the kind leading a type's heading ("Wordsearches · ") and what each of
// its lines carries on its pill.
function groupings(items) {
  const pill = (item, label) => ({ label, tone: item.tone });
  return {
    kind: () => kinds().map(k => ({
      key: k.kind, kindName: '', name: k.name, tone: '',
      items: items.filter(i => i.kind === k.kind), pill: i => pill(i, i.type),
    })),
    type: () => kinds().flatMap(k => typesOf(k.kind, items).map(type => ({
        key: `${k.kind}:${type}`, kindName: `${k.name} · `, name: type, tone: difficultyOf(k.kind, type),
        items: items.filter(i => i.kind === k.kind && i.type === type), pill: i => pill(i, i.tone),
    }))),
    difficulty: () => difficulties().map(d => ({
      key: d, kindName: '', name: d, tone: d,
      items: items.filter(i => i.tone === d), pill: i => pill(i, `${kindName(i.kind, 'one')} · ${i.type}`),
    })),
  };
}

// The groups a tab shows, none empty, each in browse's order: its heading, its count — finished of
// total signed in, every one finished a ✓; signed out, just how many — and its lines, each ticked or
// not for the puzzles finished so far. open holds the groups whose Show all is pressed.
export function scoreGroups(items, by, done, signedIn, open) {
  const order = browseOrder(items);
  return groupings(items)[by]()
    .filter(g => g.items.length > 0)
    .map(g => {
      const lines = g.items.sort(order).map(i => ({
        title: i.title, href: i.href, code: i.code, pill: g.pill(i), done: String(signedIn && tileDone(i, done)),
      }));
      const finished = lines.filter(l => l.done === 'true').length;
      const shownAll = open.includes(g.key);
      return {
        key: g.key, kindName: g.kindName, name: g.name, tone: g.tone,
        count: signedIn ? `${finished} / ${lines.length}` : String(lines.length),
        all: String(signedIn && finished === lines.length),
        lines: shownAll ? lines : lines.slice(0, SHOWN),
        more: lines.length > SHOWN ? (shownAll ? 'Show fewer' : `Show all ${lines.length}`) : '',
      };
    });
}

// Pressing Show all opens a group; Show fewer closes it again.
export function toggleOpen(open, key) {
  return open.includes(key) ? open.filter(k => k !== key) : [...open, key];
}

// Beside the page title: what's finished of every puzzle, signed in — "20 of 58 finished" — or,
// signed out, how many puzzles there are.
export function scoreTotal(items, done, signedIn) {
  const finished = items.filter(i => tileDone(i, done)).length;
  return signedIn ? `${finished} of ${items.length} finished` : `${items.length} ${items.length === 1 ? 'puzzle' : 'puzzles'}`;
}

// The sign-in line shows only once the player's progress has come back with nobody signed in, so
// a signed-in player never sees it flash.
export function signInLineHidden(known, signedIn) {
  return !known || signedIn;
}
