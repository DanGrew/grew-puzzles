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
// owner's placements in the product's docs/MOCKUP-THEMED.html, the character's captured
// 2026-10-03 and its name label's 2026-10-04: the character's centre from the grid card's
// top-left, its height, its turn, in front of or behind the cards — and its name label's centre,
// from the character's, in character heights across and down, so it moves and shrinks with it.
// On a phone every template stands the character in one spot, measured on the phone's 422 px
// grid card, with no name label. card is the grid card: its width, and its top-left from the
// page's.
export function figurePlacement(template, sits, card, phone) {
  var captured = {
    beside: { bottom: [675, 1014, 515, 0, 'front', 0.282, -0.454], right: [866, -4, 440, 0, 'behind', 0.377, -0.107], overlay: [935, 415, 675, 0, 'behind', -0.224, -0.477] },
    mirror: { bottom: [30, 1022, 510, 0, 'front', -0.353, -0.441], right: [253, 8, 385, 0, 'behind', -0.475, -0.164], overlay: [-219, 438, 635, 0, 'behind', 0.098, -0.537] },
    normal: { bottom: [670, 329, 560, 61, 'behind', 0.282, 0.22], right: [764, 48, 530, 30, 'behind', 0.483, -0.309], overlay: [30, 27, 455, -36, 'behind', -0.365, 0.116] }
  };
  var spots = { false: { spot: captured[template][sits], full: 691, label: true }, true: { spot: [369, 1, 140, 0, 'behind', 0, 0], full: 422, label: false } };
  var at = spots[phone], spot = at.spot, scale = Math.min(1, card.width / at.full);
  var left = card.left + spot[0] * scale, top = card.top + spot[1] * scale, height = spot[2] * scale;
  return {
    left: left, top: top, height: height, turn: spot[3], layer: spot[4],
    label: at.label, labelLeft: left + spot[5] * height, labelTop: top + spot[6] * height
  };
}
