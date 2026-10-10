// Themed or Plain: the owner's characters, each with its own background, dress every page when a
// player picks Themed — Plain is the site as it always was. Which character a puzzle wears, which
// of the three play-page templates, where the character stands and how big, all decided here; the
// characters themselves are content/characters/index.json, in the owner's order. The theme is
// dress, never content: no puzzle file names a character.

// The list of characters, beside their images.
export function charactersFile() {
  return '../content/characters/index.json';
}

export function charactersOf(json) {
  return json.characters;
}

// What a page needs to dress itself in a character: its figure and background as CSS images, and
// its name. No character — the list couldn't be read — dresses nothing.
export function dressOf(character) {
  var none = { figure: 'none', scene: 'none', name: '' };
  return [character].filter(Boolean).map(function (c) {
    return { figure: imageOf(c.figure), scene: imageOf(c.scene), name: c.name };
  }).concat(none)[0];
}

function imageOf(file) {
  return 'url("' + characterFile(file) + '")';
}

function characterFile(file) {
  return '../content/characters/' + file;
}

// A character's background as a file, to load ahead of the page waiting on it — none without a
// character.
export function sceneFile(character) {
  return [character].filter(Boolean).map(function (c) { return characterFile(c.scene); }).concat('')[0];
}

// Its figure as a file, the same way — for a printout to have on hand before it prints.
export function figureFile(character) {
  return [character].filter(Boolean).map(function (c) { return characterFile(c.figure); }).concat('')[0];
}

// A puzzle's number: the digits of its hidden ID.
function idNumber(hiddenId) {
  return Number(hiddenId.split('-')[1]);
}

// Puzzle 1 the first character, puzzle 2 the second, round again after the last — a collection's
// number, or a puzzle's own ID number, so a puzzle wears the same one every visit.
export function characterAt(characters, number) {
  return characters[(number - 1) % characters.length];
}

export function characterFor(characters, hiddenId) {
  return characterAt(characters, idNumber(hiddenId));
}

// A landing tile's character: a puzzle's own, and a collection's its puzzle 1's — the first.
export function tileCharacter(characters, item) {
  return { puzzle: characterFor, collection: function (list) { return characterAt(list, 1); } }[item.kind](characters, item.ids[0]);
}

// A text page's, or the landing page's background: any one, picked fresh on every load.
export function randomCharacter(characters, random) {
  return characters[Math.floor(random() * characters.length)];
}

// Which template a puzzle's play page wears — the character on the right, its mirror on the left,
// or the normal page — spread evenly by its ID number, the same on every visit.
export function templateFor(hiddenId) {
  return ['beside', 'mirror', 'normal'][(idNumber(hiddenId) - 1) % 3];
}

// A placement shrinks with the grid card, in proportion, on a card narrower than the one the owner
// placed the characters on (691 px wide); never grows past it.
export function themeScale(cardWidth) {
  return Math.min(1, cardWidth / 691);
}

// A phone: a screen no wider than the play page's phone layout (styles/play.css, 760 px).
export function isPhone(screenWidth) {
  return screenWidth <= 760;
}

// The room the words card leaves the character beside it, under the grid in templates beside and
// mirror, at full size: the character's 240 px and a 14 px gap. None when Plain, and none on a
// phone, where the words keep the grid card's width.
export function wordsRoom(look, template, phone) {
  var rooms = { beside: 254, mirror: 254, normal: 0 };
  return { themed: rooms[template], plain: 0 }[look] * Number(!phone);
}

// Where the character stands on the play page, for a template and where the words sit — the
// owner's placements in the product's docs/MOCKUP-THEMED.html, captured 2026-10-05 with all 12
// characters in view on a 691 × 733 px grid card: the character's centre from the grid card's
// top-left, its height, its turn, its name label's centre, from the character's, in character
// heights across and down, so it moves and shrinks with it, and whether it's flipped to face
// right, towards the grid, from the left every character faces. Every one stands behind the cards
// (styles/look.css), the owner's call 2026-10-05.
// The owner placed each one against the card edges nearest it, and those are its anchors — the
// last two: 0 holds it from the card's left (or top), 1 from its right (or bottom). On any other
// grid card it keeps its offset from them, so it stays beside the grid whatever the grid's size
// (TASK-64). On a card narrower than 691 px the offsets and the size shrink in proportion; on a
// wider one, neither grows.
// On a phone every template stands the character in one spot, facing left, measured from the
// phone's 422 px grid card's top-left, with no name label. card is the grid card: its width and
// height, and its top-left from the page's.
export function figurePlacement(template, sits, card, phone) {
  var captured = {
    beside: {
      bottom: [656, 1004, 700, 0, -0.156, 0.166, false, 1, 1], right: [870, -29, 440, 0, 0.377, -0.107, false, 1, 0],
      overlay: [904, 732, 700, 0, -0.121, -0.389, false, 1, 1]
    },
    mirror: {
      bottom: [15, 1030, 695, 0, -0.187, 0.039, true, 0, 1], right: [256, -32, 385, 0, -0.322, -0.104, true, 0, 0],
      overlay: [-190, 432, 635, 0, 0.036, -0.391, true, 0, 1]
    },
    normal: {
      bottom: [719, 293, 560, 61, 0.143, 0.173, false, 1, 0], right: [275, -31, 455, -24, -0.376, -0.136, true, 0, 0],
      overlay: [-89, 309, 455, -90, -0.018, 0.341, false, 0, 0]
    }
  };
  var spots = {
    false: { spot: captured[template][sits], full: [691, 733], label: true },
    true: { spot: [369, 1, 140, 0, 0, 0, false, 0, 0], full: [422, 0], label: false }
  };
  var at = spots[phone], spot = at.spot, scale = Math.min(1, card.width / at.full[0]);
  var left = card.left + fromEdge(spot[0], spot[7], card.width, at.full[0], scale);
  var top = card.top + fromEdge(spot[1], spot[8], card.height, at.full[1], scale);
  var height = spot[2] * scale;
  return {
    left: left, top: top, height: height, turn: spot[3], flip: spot[6],
    label: at.label, labelLeft: left + spot[4] * height, labelTop: top + spot[5] * height
  };
}

// A captured offset along one side of the card, kept from its anchor edge: the near edge (left or
// top) as captured, or the far edge (right or bottom) by how far beyond or short of it it was
// captured — scaled with the card either way.
function fromEdge(captured, far, size, full, scale) {
  return far * size + (captured - far * full) * scale;
}

// The tallest the words card grows under the grid before its list scrolls, Themed: the character's
// own height in its spot, so it stands beside the whole card, the owner's call 2026-10-05 — no cap
// on a phone, where the character stands small over the grid card instead.
export function wordsCap(placement, phone) {
  return { false: placement.height + 'px', true: 'none' }[phone];
}

// How the character is drawn on its spot: centred on it, turned, and mirrored when flipped — the
// figure only, never its name label, which reads the right way round wherever it stands.
export function figureTransform(placement) {
  return 'translate(-50%, -50%) rotate(' + placement.turn + 'deg)' + ['', ' scaleX(-1)'][Number(placement.flip)];
}

// ---- Printed Colour or Black and white (TASK-46) ----
// Paper is measured at 96 px to the inch, as the browser prints it. A sheet keeps half an inch
// inside the paper's edge; a printer reaches to a quarter inch of it.
const PRINT_REACH = 24;

// A printed sheet is one of three: a puzzle of one grid, its grid card over its words; a puzzle of
// several grids' words sheet, its words card alone; or one of its grid sheets.
// The paper a sheet is laid out on: the book's US Letter; the play page's whatever the player's
// printer takes, so the narrower of A4 and Letter across, and the shorter down.
export function printPaper(book) {
  return [{ width: 794, height: 1056 }, { width: 816, height: 1056 }][Number(book)];
}

// A printed grid's cell, as styles/play.css's print rules size it: a one-grid sheet leaves its
// words 105 mm down, a grid sheet of its own takes 200 mm; 14 pt at the least, and never wider
// than the 7.5 in a sheet has across. Big letters (letters, play-core's playBoard) grow it by
// that much, the grid no wider than the words' 165 mm unless a Vanilla's already is.
export function printCell(cols, rows, paged, letters) {
  const down = [396.85, 755.91][Number(paged)];
  const cell = Math.max(18.67, Math.min(36, 623.62 / cols, down / rows));
  return Math.min(cell * letters, Math.max(cell, 623.62 / cols), 720 / cols);
}

// The card a character peers from, across: the grid card — its cells, 14 px inside each side and
// its 2 px outline — or, on a words sheet, the words card, the paper's whole width less its
// half-inch edges.
export function printCardWidth(sheet, cols, rows, letters, paper) {
  const grid = paged => cols * printCell(cols, rows, paged, letters) + 32;
  return { one: grid(false), grid: grid(true), words: paper.width - 96 }[sheet];
}

// How far down the paper that card's top sits, before any rise: the half-inch edge, the book's
// puzzle number, the title on its white tag (a grid sheet's without the date), its 16 px, and on a
// words sheet the 20 px the hidden grid card leaves. Measured from the printout itself, a title of
// one line — a longer one only sits the card lower.
export function printCardTop(sheet, numbered) {
  return 48 + 29 * Number(numbered) + { one: 76 + 16, words: 76 + 16 + 20, grid: 57 + 16 }[sheet];
}

// The owner's four spots, handed back 2026-10-08 from the product's docs/MOCKUP-THEMED-PRINT.html,
// on the one-grid sheet's 429 × 472 px grid card: the character's centre from the card's top-left
// corner, its height, its turn (clockwise positive) and whether it's flipped to face right. On paper
// it wears no name label, the owner's call 2026-10-09. Each is held from the card edges nearest it —
// the right two from the card's right edge, the left two from its left, all from its top — so a
// wider card, a Saga's words card or any grid's, keeps it as far from the corner.
function printSpot(spot) {
  return {
    right: { x: 439, y: 188, height: 293, turn: 37, flip: true, far: 1 },
    left: { x: -1, y: 171, height: 293, turn: -41, flip: false, far: 0 },
    topRight: { x: 378, y: -13, height: 213, turn: -3, flip: true, far: 1 },
    topLeft: { x: 49, y: -14, height: 213, turn: 12, flip: false, far: 0 }
  }[spot];
}

// A spot on a card cardWidth across: its centre from the card's left, and from the edge it's held
// from (far, 1 for the right edge), so the page can place it by that edge whatever the card's
// printed width.
export function printPlacement(spot, cardWidth) {
  const s = printSpot(spot);
  const fromEdge = s.x - s.far * 429;
  return { spot, far: s.far, fromEdge, x: s.far * cardWidth + fromEdge, y: s.y, height: s.height, turn: s.turn, flip: s.flip };
}

// The box round a character's inked outline as it stands — sized, flipped, then turned as the page
// draws it — from its centre. Its outline is a band down the image at a time, each its leftmost and
// rightmost opaque edge across (content/characters/index.json); without one, the whole image.
export function inkBox(outline, height, turn, flip) {
  const bands = outline || [[0, 1]];
  const width = height * 508 / 640, a = turn * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  const points = bands.flatMap((band, i) => [band].filter(Boolean).flatMap(b => [i, i + 1].flatMap(edge => b.map(f => {
    const x = ([f, 1 - f][Number(flip)] - 0.5) * width, y = (edge / bands.length - 0.5) * height;
    return [x * cos - y * sin, x * sin + y * cos];
  }))));
  return {
    left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])),
    top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1]))
  };
}

// How much lower a sheet starts so the character's head stays inside what a printer reaches.
// frame is the sheet's paper, its card's width and its card's top on the paper.
export function printRise(spot, frame, outline) {
  const p = printPlacement(spot, frame.cardWidth);
  return Math.max(0, PRINT_REACH - (frame.cardTop + p.y + inkBox(outline, p.height, p.turn, p.flip).top));
}

// Whether what shows of the character stays inside what a printer reaches across: at the sides,
// only what stands past the card shows, and the room left on its nearer side is what counts.
function printFits(spot, frame, outline) {
  const p = printPlacement(spot, frame.cardWidth);
  const ink = inkBox(outline, p.height, p.turn, p.flip);
  const cardLeft = (frame.paper.width - frame.cardWidth) / 2, centre = cardLeft + p.x;
  const whole = [centre + ink.left, centre + ink.right];
  const shows = { right: [cardLeft + frame.cardWidth, whole[1]], left: [whole[0], cardLeft], topRight: whole, topLeft: whole }[spot];
  return Math.min(shows[0], frame.paper.width - shows[1]) >= PRINT_REACH;
}

// The spots a sheet picks from: a one-grid sheet's all four, a Saga's sheets only the top corners —
// those that fit across. A one-grid sheet never starts lower, which could push it onto a second
// page: a spot that needs it is left out. None fits, and every one the sheet has is picked from.
export function printChoices(sheet, frame, outline) {
  const all = { one: ['right', 'left', 'topRight', 'topLeft'], words: ['topRight', 'topLeft'], grid: ['topRight', 'topLeft'] }[sheet];
  const settled = { one: spot => printRise(spot, frame, outline) === 0, words: () => true, grid: () => true }[sheet];
  const fit = all.filter(spot => printFits(spot, frame, outline) && settled(spot));
  return [fit, all][Number(fit.length === 0)];
}

// Each time a sheet prints: a spot at random from its choices, and how to draw the character
// there — its centre from the card edge it's held from — and the sheet's rise. No character — the
// list couldn't be read — is judged as a whole image.
export function printDress(sheet, frame, character, random) {
  const outline = [character].filter(Boolean).map(c => c.outline)[0];
  const choices = printChoices(sheet, frame, outline);
  const spot = choices[Math.floor(random() * choices.length)];
  const p = printPlacement(spot, frame.cardWidth);
  return {
    spot, left: 'calc(' + p.far * 100 + '% + ' + p.fromEdge + 'px)', top: p.y + 'px', height: p.height + 'px',
    transform: figureTransform(p), rise: printRise(spot, frame, outline) + 'px'
  };
}
