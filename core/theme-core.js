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
  return 'url("../content/characters/' + file + '")';
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
