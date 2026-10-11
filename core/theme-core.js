// Themed or Plain: the owner's characters, each with its own background, dress every page when a
// player picks Themed — Plain is the site as it always was. Which character a puzzle wears, which
// of the printout's four spots it peers from on screen and on paper, and how big, all decided here;
// the characters themselves are content/characters/index.json, in the owner's order. The theme is
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
export function idNumber(hiddenId) {
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

// A phone: a screen no wider than the play page's phone layout (styles/play.css, 760 px).
export function isPhone(screenWidth) {
  return screenWidth <= 760;
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
  return { one: printGridWidth(cols, rows, letters, false), grid: printGridWidth(cols, rows, letters, true), words: paper.width - 96 }[sheet];
}

// A printed grid card across, whatever the paper: its cells, on a one-grid sheet or a grid sheet
// of its own (paged), and 32 px.
function printGridWidth(cols, rows, letters, paged) {
  return cols * printCell(cols, rows, paged, letters) + 32;
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
// corner, its height, its turn (clockwise positive) and whether it's flipped to face right; and its
// name label's centre from the character's, in character heights across and down. On paper it
// wears no name label, the owner's call 2026-10-09 — only a screen wider than a phone does
// (sitePlacement). Each is held from the card edges nearest it — the right two from the card's
// right edge, the left two from its left, all from its top — so a wider card, a Saga's words card
// or any grid's, keeps it as far from the corner.
function printSpot(spot) {
  return {
    right: { x: 439, y: 188, height: 293, turn: 37, flip: true, far: 1, label: [0.3, 0.52] },
    left: { x: -1, y: 171, height: 293, turn: -41, flip: false, far: 0, label: [-0.3, 0.52] },
    topRight: { x: 378, y: -13, height: 213, turn: -3, flip: true, far: 1, label: [0.62, -0.05] },
    topLeft: { x: 49, y: -14, height: 213, turn: 12, flip: false, far: 0, label: [-0.62, -0.05] }
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

// ---- On screen, Themed (TASK-146) ----
// The site wears the printout's four spots, so Themed is one picture on screen and on paper: the
// play page's character peers from its grid card, a text page's from its text card. Which spot is
// the page's number round the spots that show — a puzzle's own, a text page's its place in the side
// bar — so it never changes between visits on the same screen, the owner's call 2026-10-11.

// The spots a page picks from: all four, but a Saga's play page — as its printed sheets — and any
// page on a phone only the top corners.
export function siteChoices(saga, phone) {
  return [['right', 'left', 'topRight', 'topLeft'], ['topRight', 'topLeft']][Number(saga || phone)];
}

// How big the play page draws the printout's picture: its grid card on screen against the card the
// puzzle prints on — the one-grid sheet's, or a Saga's grid sheet's — so the character stands as
// big against the grid, and as far from its corner, as on paper.
export function siteScale(cardWidth, cols, rows, letters, saga) {
  return cardWidth / printGridWidth(cols, rows, letters, saga);
}

// How big a maze page draws it (TASK-104): a maze doesn't print yet, so against the card the owner
// placed the spots on, the one-grid sheet's 429 × 472 px, fitted inside the maze card — sized to the
// window's height, so a shorter window's smaller card wears a smaller character.
export function mazeScale(cardWidth, cardHeight) {
  return Math.min(cardWidth / 429, cardHeight / 472);
}

// A box on the window — a card, the title — as siteDress measures it: from origin's top-left
// corner, the part of the page its character is placed in.
export function boxFrom(box, origin) {
  return { left: box.left - origin.left, top: box.top - origin.top, width: box.width, height: box.height };
}

// A spot on a page: the character's centre, held from the card edge it's held from, and its
// height, both at the frame's scale; its turn and facing; and its name label's centre. frame.card
// is the card's left, top, width and height on the page.
export function sitePlacement(spot, frame) {
  const s = printSpot(spot), p = printPlacement(spot, frame.card.width), card = frame.card, height = s.height * frame.scale;
  const left = card.left + p.far * card.width + p.fromEdge * frame.scale, top = card.top + s.y * frame.scale;
  return { spot, left, top, height, turn: s.turn, flip: s.flip, labelLeft: left + s.label[0] * height, labelTop: top + s.label[1] * height };
}

// Whether a spot shows: what stands past the card — at the sides only that, at a top corner the
// whole character — and its name label stay inside the screen's edges, and none of the page's other
// cards covers either. frame.label is the label's width and height — none, and so not judged, on a
// phone or without a name.
function siteShows(spot, frame, outline) {
  const { box, label } = siteBoxes(spot, frame, outline), card = frame.card;
  const shows = { right: [card.left + card.width, box.right], left: [box.left, card.left], topRight: [box.left, box.right], topLeft: [box.left, box.right] }[spot];
  const across = [[Math.min(shows[0], label.left), Math.max(shows[1], label.right)], shows][Number(frame.label.width === 0)];
  return across[0] >= frame.screen.left && across[1] <= frame.screen.right && clearOf(box, frame.covers, card) && clearOf(label, frame.covers, card);
}

// Whether none of the others covers a part — the character or its name label.
function clearOf(part, others, card) {
  return !others.some(other => covered(part, other, card));
}

// The box round a spot's character's inked outline on the page, and round its name label.
function siteBoxes(spot, frame, outline) {
  const p = sitePlacement(spot, frame), ink = inkBox(outline, p.height, p.turn, p.flip);
  return {
    box: { left: p.left + ink.left, right: p.left + ink.right, top: p.top + ink.top, bottom: p.top + ink.bottom },
    label: {
      left: p.labelLeft - frame.label.width / 2, right: p.labelLeft + frame.label.width / 2,
      top: p.labelTop - frame.label.height / 2, bottom: p.labelTop + frame.label.height / 2
    }
  };
}

// Whether a spot keeps its character and its name label off the page's title, the owner's call
// 2026-10-11 — frame.title the title's box, its left, top, width and height.
function clearOfTitle(spot, frame, outline) {
  const { box, label } = siteBoxes(spot, frame, outline), t = frame.title;
  const meets = b => b.left < t.left + t.width && t.left < b.right && b.top < t.top + t.height && t.top < b.bottom;
  return !meets(box) && !meets(label);
}

// Whether another card — a wordsearch's words, a maze's checklist or its control pad — covers some
// of the character where the card it peers from doesn't: beside or under the grid; laid over the
// grid, it covers only what the grid card already hides.
function covered(box, other, card) {
  const meet = {
    left: Math.max(box.left, other.left), right: Math.min(box.right, other.left + other.width),
    top: Math.max(box.top, other.top), bottom: Math.min(box.bottom, other.top + other.height)
  };
  const behind = meet.left >= card.left && meet.right <= card.left + card.width && meet.top >= card.top && meet.bottom <= card.top + card.height;
  return meet.left < meet.right && meet.top < meet.bottom && !behind;
}

// Where a page's character stands: its number round the spots that show with its name label, on a
// screen wider than a phone; none does, round those that show without it, the label left off as
// paper leaves it; none does still, round those that keep it out from behind the cards it must
// never stand behind, and failing that round every one it has. Each way, the spots that keep clear
// of the title come first, where any does. Drawn centred, turned and mirrored when flipped. frame
// is the card, the scale, the screen's left and right edges on the page, the other cards that may
// cover it (covers — a wordsearch's words card, a maze's checklist and control pad, a text page
// none), those of them it never stands behind even then (never — a maze's two, the owner's call
// 2026-10-11; none elsewhere), the title, the name label's size, and whether it's a Saga and a
// phone.
// No character — the list couldn't be read — is judged as a whole image.
export function siteDress(frame, character, number) {
  const outline = [character].filter(Boolean).map(c => c.outline)[0];
  const choices = siteChoices(frame.saga, frame.phone);
  const bare = { ...frame, label: { width: 0, height: 0 } };
  const labelled = choices.filter(spot => siteShows(spot, frame, outline));
  const unlabelled = choices.filter(spot => siteShows(spot, bare, outline));
  const tiers = [
    { spots: labelled.filter(spot => clearOfTitle(spot, frame, outline)), label: !frame.phone },
    { spots: unlabelled.filter(spot => clearOfTitle(spot, bare, outline)), label: false },
    { spots: labelled, label: !frame.phone },
    { spots: unlabelled, label: false },
    { spots: choices.filter(spot => clearOf(siteBoxes(spot, bare, outline).box, frame.never, frame.card)), label: false },
    { spots: choices, label: false }
  ];
  const tier = tiers.find(t => t.spots.length > 0);
  const p = sitePlacement(tier.spots[(number - 1) % tier.spots.length], frame);
  return {
    spot: p.spot, left: p.left + 'px', top: p.top + 'px', height: p.height + 'px', transform: figureTransform(p),
    label: tier.label, labelLeft: p.labelLeft + 'px', labelTop: p.labelTop + 'px'
  };
}
