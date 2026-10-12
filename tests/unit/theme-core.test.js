import { readFileSync } from 'node:fs';
import {
  charactersFile, charactersOf, dressOf, sceneFile, figureFile, characterAt, characterFor, tileCharacter, randomCharacter, idNumber,
  isPhone, figureTransform, siteChoices, siteScale, mazeScale, boxFrom, sitePlacement, siteDress,
  printPaper, printCell, printCardWidth, printCardTop, printPlacement, inkBox, printRise, printChoices, printDress, minesPrintFrame, crissPrintFrame
} from '../../core/theme-core.js';

// Three characters stand in for the owner's list, in order.
const cast = () => [
  { name: 'Bunnosaur', figure: 'bunnosaur.webp', scene: 'bunnosaur-bg.webp' },
  { name: 'Catosaur', figure: 'catosaur.webp', scene: 'catosaur-bg.webp' },
  { name: 'Duckosaur', figure: 'duckosaur.webp', scene: 'duckosaur-bg.webp' }
];

describe('the characters list', () => {
  test('is read from content/characters/index.json, beside the images', () => {
    expect(charactersFile()).toBe('../content/characters/index.json');
    expect(charactersOf({ characters: cast() })).toEqual(cast());
  });

  test('a character dresses a page in its figure and background, from beside the list, and its name', () => {
    expect(dressOf(cast()[1])).toEqual({
      figure: 'url("../content/characters/catosaur.webp")', scene: 'url("../content/characters/catosaur-bg.webp")', name: 'Catosaur'
    });
  });

  test('no character — the list could not be read — dresses nothing', () => {
    expect(dressOf(undefined)).toEqual({ figure: 'none', scene: 'none', name: '' });
  });

  test('a character\'s background, as a file to load ahead, beside the images', () => {
    expect(sceneFile(cast()[1])).toBe('../content/characters/catosaur-bg.webp');
  });

  test('no character has no background file to load', () => {
    expect(sceneFile(undefined)).toBe('');
  });

  test('a character\'s figure, as a file to load ahead, beside the images — none without a character', () => {
    expect(figureFile(cast()[1])).toBe('../content/characters/catosaur.webp');
    expect(figureFile(undefined)).toBe('');
  });
});

describe('which character a puzzle wears', () => {
  test('puzzle 1 the first, puzzle 2 the second, round again after the last', () => {
    expect([1, 2, 3, 4, 5, 7].map(n => characterAt(cast(), n).name)).toEqual(['Bunnosaur', 'Catosaur', 'Duckosaur', 'Bunnosaur', 'Catosaur', 'Bunnosaur']);
  });

  test('a puzzle on its own wears the one its hidden ID number lands on, the same every visit', () => {
    expect(characterFor(cast(), 'WSCH-0001').name).toBe('Bunnosaur');
    expect(characterFor(cast(), 'WSCH-0005').name).toBe('Catosaur');
    expect(characterFor(cast(), 'WSCH-0012').name).toBe('Duckosaur');
  });

  test('no characters, no character', () => {
    expect(characterFor([], 'WSCH-0001')).toBeUndefined();
  });

  test('a landing tile wears its puzzle\'s character, and a collection\'s its puzzle 1\'s — the first', () => {
    expect(tileCharacter(cast(), { kind: 'puzzle', ids: ['WSCH-0002'] }).name).toBe('Catosaur');
    expect(tileCharacter(cast(), { kind: 'collection', ids: ['WSCH-0002', 'WSCH-0003'] }).name).toBe('Bunnosaur');
  });

  test('a text page or the landing page picks any one at random, the last included', () => {
    expect(randomCharacter(cast(), () => 0).name).toBe('Bunnosaur');
    expect(randomCharacter(cast(), () => 0.34).name).toBe('Catosaur');
    expect(randomCharacter(cast(), () => 0.999).name).toBe('Duckosaur');
  });
});

describe('a puzzle\'s number', () => {
  test('is the digits of its hidden ID', () => {
    expect(['WSCH-0001', 'WSCH-0050', 'MAZE-0123'].map(idNumber)).toEqual([1, 50, 123]);
  });
});

describe('a phone', () => {
  test('is a window no wider than the play page\'s phone layout, 760px', () => {
    expect(isPhone(760)).toBe(true);
    expect(isPhone(761)).toBe(false);
  });
});

// A character whose ink fills the lower half of its image, a fifth of its width, and nothing above.
const lowHalf = () => [null, null, [0.4, 0.6], [0.4, 0.6]];
// Paper with room either side of a 429 px grid card for even a whole image at the sides: the card
// from 285.5 to 714.5 across.
const roomy = () => ({ paper: { width: 1000, height: 1056 }, cardWidth: 429, cardTop: 140 });
// How far a spot's whole-image ink reaches past the card edge it's held from, outwards.
const pastEdge = spot => {
  const p = printPlacement(spot, 429), ink = inkBox(undefined, p.height, p.turn, p.flip);
  return [-(p.fromEdge + ink.left), p.fromEdge + ink.right][p.far];
};

describe('printed Colour or Black and white: the sheet', () => {
  test('the play page lays out on the narrower of A4 and Letter across and the shorter down; the book on Letter', () => {
    expect(printPaper(false)).toEqual({ width: 794, height: 1056 });
    expect(printPaper(true)).toEqual({ width: 816, height: 1056 });
  });

  test('a one-grid sheet\'s cell leaves its words 105 mm down; a grid sheet of its own takes 200 mm', () => {
    expect(printCell(15, 15, false, 1)).toBeCloseTo(396.85 / 15, 5);
    expect(printCell(15, 15, true, 1)).toBe(36);
    expect(printCell(8, 30, true, 1)).toBeCloseTo(755.91 / 30, 5);
  });

  test('a cell is 14 pt at the least, never wider than the sheet\'s 7.5 in across, never over 36 px, never wider than 165 mm a row', () => {
    expect(printCell(30, 30, false, 1)).toBe(18.67);
    expect(printCell(40, 10, false, 1)).toBe(18);
    expect(printCell(5, 5, false, 1)).toBe(36);
    expect(printCell(20, 5, false, 1)).toBeCloseTo(623.62 / 20, 5);
  });

  // TASK-114: a Kids puzzle's big letters print 1.5× a Vanilla's, the grid no wider than the words.
  test('big letters print the cell 1.5× a Vanilla\'s, never wider than 165 mm a row, unless a Vanilla\'s already is', () => {
    expect(printCell(8, 8, false, 1.5)).toBe(54);
    expect(printCell(15, 15, false, 1.5)).toBeCloseTo(396.85 / 15 * 1.5, 5);
    expect(printCell(5, 5, false, 1.5)).toBe(54);
    expect(printCell(15, 6, false, 1.5)).toBeCloseTo(623.62 / 15, 5);
    expect(printCell(36, 36, false, 1.5)).toBeCloseTo(18.67, 5);
    expect(printCell(40, 10, false, 1.5)).toBe(18);
  });

  test('the card a character peers from: a grid card is its cells and 32 px; a words card the paper less its half-inch edges', () => {
    expect(printCardWidth('one', 15, 15, 1, printPaper(false))).toBeCloseTo(396.85 + 32, 5);
    expect(printCardWidth('grid', 15, 15, 1, printPaper(false))).toBe(15 * 36 + 32);
    expect(printCardWidth('one', 8, 8, 1.5, printPaper(false))).toBe(8 * 54 + 32);
    expect(printCardWidth('words', 15, 15, 1, printPaper(false))).toBe(794 - 96);
    expect(printCardWidth('words', 15, 15, 1, printPaper(true))).toBe(816 - 96);
  });

  test('its top sits under the half-inch edge, the title and its 16 px — a words sheet 20 px more, a grid sheet\'s title without its date — and in the book under the puzzle\'s number', () => {
    expect([printCardTop('one', false), printCardTop('words', false), printCardTop('grid', false)]).toEqual([140, 160, 121]);
    expect([printCardTop('one', true), printCardTop('words', true), printCardTop('grid', true)]).toEqual([169, 189, 150]);
  });
});

// TASK-140: a minesweeper board prints on Letter, its grid as big as the page allows.
describe('printed Colour or Black and white: a minesweeper board\'s sheet', () => {
  test('it is always US Letter, its card the board\'s longer side at 7.2 in and the 5 px its border adds', () => {
    expect(minesPrintFrame(10, 10, false).paper).toEqual({ width: 816, height: 1056 });
    expect(minesPrintFrame(10, 10, false).cardWidth).toBeCloseTo(691.2 + 5, 5);
    expect(minesPrintFrame(30, 15, false).cardWidth).toBeCloseTo(691.2 + 5, 5);
    expect(minesPrintFrame(15, 30, false).cardWidth).toBeCloseTo(345.6 + 5, 5);
  });

  test('its card\'s top sits under the half inch, the title on its tag and the rule — in the book under the puzzle\'s number too', () => {
    expect(minesPrintFrame(10, 10, false).cardTop).toBeCloseTo(48 + 162.66, 5);
    expect(minesPrintFrame(10, 10, true).cardTop).toBeCloseTo(48 + 29 + 162.66, 5);
  });

  test('Bunnosaur peers only over a top corner of a full-width board; slimmer Catosaur may peek past a side too', () => {
    const { characters } = JSON.parse(readFileSync(new URL('../../content/characters/index.json', import.meta.url), 'utf8'));
    const outline = name => characters.find(c => c.name === name).outline;
    expect(printChoices('one', minesPrintFrame(10, 10, false), outline('Bunnosaur'))).toEqual(['topRight', 'topLeft']);
    expect(printChoices('one', minesPrintFrame(10, 10, false), outline('Catosaur'))).toEqual(['right', 'left', 'topRight', 'topLeft']);
  });
});

// TASK-154: a criss-cross prints on Letter, its shape as big as fits 6.9 in across and 4.4 in down,
// its squares never over 0.36 in.
describe('printed Colour or Black and white: a criss-cross\'s sheet', () => {
  test('it is always US Letter, its card the shape\'s squares and the 34 px its padding and outline add', () => {
    expect(crissPrintFrame(17, 15, false).paper).toEqual({ width: 816, height: 1056 });
    // 15 rows share 4.4 in; 25 columns share 6.9 in; 5 squares a side stop at 0.36 in.
    expect(crissPrintFrame(17, 15, false).cardWidth).toBeCloseTo(17 * 422.4 / 15 + 34, 5);
    expect(crissPrintFrame(25, 8, false).cardWidth).toBeCloseTo(662.4 + 34, 5);
    expect(crissPrintFrame(5, 5, false).cardWidth).toBeCloseTo(5 * 34.56 + 34, 5);
  });

  test('its card\'s top sits under the half inch, the title on its tag and the rule — in the book under the puzzle\'s number too', () => {
    expect(crissPrintFrame(17, 15, false).cardTop).toBeCloseTo(48 + 129.98, 5);
    expect(crissPrintFrame(17, 15, true).cardTop).toBeCloseTo(48 + 29 + 129.98, 5);
  });

  test('a wide shape leaves Bunnosaur only a top corner, where a 17×15 lets it peek past a side; slim Catosaur may on either', () => {
    const { characters } = JSON.parse(readFileSync(new URL('../../content/characters/index.json', import.meta.url), 'utf8'));
    const outline = name => characters.find(c => c.name === name).outline;
    expect(printChoices('one', crissPrintFrame(17, 15, false), outline('Bunnosaur'))).toEqual(['right', 'left', 'topRight', 'topLeft']);
    expect(printChoices('one', crissPrintFrame(25, 8, false), outline('Bunnosaur'))).toEqual(['topRight', 'topLeft']);
    expect(printChoices('one', crissPrintFrame(25, 8, false), outline('Catosaur'))).toEqual(['right', 'left', 'topRight', 'topLeft']);
  });
});

describe('printed Colour or Black and white: where the character stands', () => {
  test('the right two are held from the card\'s right edge, as far from it as on the owner\'s 429 px card', () => {
    expect(printPlacement('right', 500)).toEqual({ spot: 'right', far: 1, fromEdge: 10, x: 510, y: 188, height: 293, turn: 37, flip: true });
    expect(printPlacement('topRight', 500)).toEqual({ spot: 'topRight', far: 1, fromEdge: -51, x: 449, y: -13, height: 213, turn: -3, flip: true });
  });

  test('the left two are held from its left edge, whatever its width', () => {
    expect(printPlacement('left', 900)).toEqual({ spot: 'left', far: 0, fromEdge: -1, x: -1, y: 171, height: 293, turn: -41, flip: false });
    expect(printPlacement('topLeft', 900)).toEqual({ spot: 'topLeft', far: 0, fromEdge: 49, x: 49, y: -14, height: 213, turn: 12, flip: false });
  });
});

describe('printed Colour or Black and white: a character\'s inked outline', () => {
  test('without an outline, the whole image, 508 × 640, from its centre', () => {
    expect(inkBox(undefined, 640, 0, false)).toEqual({ left: -254, right: 254, top: -320, bottom: 320 });
  });

  test('each band reaches from its own top to its bottom, between its edges; a clear band reaches nowhere', () => {
    expect(inkBox([null, [0.25, 0.75]], 640, 0, false)).toEqual({ left: -127, right: 127, top: 0, bottom: 320 });
    expect(inkBox([[0.25, 0.5], null], 640, 0, false)).toEqual({ left: -127, right: 0, top: -320, bottom: 0 });
  });

  test('flipped, mirrored across its centre', () => {
    const box = inkBox([[0.1, 0.5]], 640, 0, true);
    expect([box.left + 0, box.right, box.top, box.bottom]).toEqual([0, (0.5 - 0.1) * 508, -320, 320]);
  });

  test('turned clockwise about its centre', () => {
    const box = inkBox(undefined, 640, 90, false);
    expect([box.left, box.right, box.top, box.bottom].map(n => Math.round(n))).toEqual([-320, 320, -254, 254]);
    const tilted = inkBox([null, [0.5, 1]], 640, 30, false);
    expect(tilted.top).toBeCloseTo(0, 5);
    expect(tilted.right).toBeCloseTo(254 * Math.cos(Math.PI / 6), 5);
    expect(tilted.bottom).toBeCloseTo(254 * Math.sin(Math.PI / 6) + 320 * Math.cos(Math.PI / 6), 5);
    expect(tilted.left).toBeCloseTo(-320 * Math.sin(Math.PI / 6), 5);
  });
});

describe('printed Colour or Black and white: starting the sheet lower', () => {
  test('a head that stays a quarter inch inside the paper needs no rise', () => {
    expect(printRise('topLeft', roomy(), lowHalf())).toBe(0);
    expect(printRise('right', roomy(), undefined)).toBe(0);
  });

  test('exactly a quarter inch inside, no rise; a pixel nearer, a pixel lower', () => {
    const p = printPlacement('topRight', 429), head = -(p.y + inkBox(undefined, p.height, p.turn, p.flip).top);
    expect(printRise('topRight', { ...roomy(), cardTop: 24 + head }, undefined)).toBeCloseTo(0, 9);
    expect(printRise('topRight', { ...roomy(), cardTop: 25 + head }, undefined)).toBe(0);
    expect(printRise('topRight', { ...roomy(), cardTop: 23 + head }, undefined)).toBeCloseTo(1, 9);
  });

  test('a head nearer the paper\'s edge than a printer reaches starts the sheet as much lower as it needs', () => {
    // The whole image at the top-left: 213 px tall, 169 across, turned 12°, its centre 14 px over the card.
    const reach = 106.5 * Math.cos(Math.PI / 15) + (213 * 508 / 640 / 2) * Math.sin(Math.PI / 15);
    expect(printRise('topLeft', { ...roomy(), cardTop: 100 }, undefined)).toBeCloseTo(24 - (100 - 14 - reach), 5);
  });
});

describe('printed Colour or Black and white: the spots a sheet picks from', () => {
  test('a one-grid sheet with room picks from all four', () => {
    expect(printChoices('one', roomy(), lowHalf())).toEqual(['right', 'left', 'topRight', 'topLeft']);
    expect(printChoices('one', { ...roomy(), cardTop: 400 }, undefined)).toEqual(['right', 'left', 'topRight', 'topLeft']);
  });

  test('a Saga\'s words and grid sheets only from the top corners', () => {
    expect(printChoices('words', { ...roomy(), cardWidth: 623.62 }, lowHalf())).toEqual(['topRight', 'topLeft']);
    expect(printChoices('grid', roomy(), lowHalf())).toEqual(['topRight', 'topLeft']);
  });

  test('a card too wide leaves no room past it at the sides: only the top corners', () => {
    expect(printChoices('one', { ...roomy(), cardWidth: 650, cardTop: 400 }, undefined)).toEqual(['topRight', 'topLeft']);
  });

  // The narrowest paper each side fits on, the card centred: its edge, what reaches past it, and a
  // quarter inch, on both sides.
  const fitsOn = spot => 429 + 2 * pastEdge(spot) + 48;

  test('a side is left out once what shows past the card reaches past the edge a printer reaches, each side on its own', () => {
    expect(pastEdge('right')).toBeGreaterThan(pastEdge('left'));
    const on = width => printChoices('one', { ...roomy(), paper: { width, height: 1056 }, cardTop: 400 }, undefined);
    expect(on(fitsOn('right') + 0.001)).toEqual(['right', 'left', 'topRight', 'topLeft']);
    expect(on(fitsOn('right') - 0.001)).toEqual(['left', 'topRight', 'topLeft']);
    expect(on(fitsOn('left') + 0.001)).toEqual(['left', 'topRight', 'topLeft']);
    expect(on(fitsOn('left') - 0.001)).toEqual(['topRight', 'topLeft']);
  });

  test('a top corner is left out once its ink runs past the edge a printer reaches, on either side', () => {
    expect(pastEdge('topLeft')).toBeGreaterThan(pastEdge('topRight'));
    for (const sheet of ['grid', 'words']) {
      const on = width => printChoices(sheet, { ...roomy(), paper: { width, height: 1056 }, cardTop: 400 }, undefined);
      expect(on(fitsOn('topLeft') + 0.001)).toEqual(['topRight', 'topLeft']);
      expect(on(fitsOn('topLeft') - 0.001)).toEqual(['topRight']);
      expect(on(fitsOn('topRight') + 0.001)).toEqual(['topRight']);
      expect(on(fitsOn('topRight') - 0.001)).toEqual(['topRight', 'topLeft']);
    }
  });

  test('ink exactly a quarter inch from the paper\'s edge still fits', () => {
    // The paper on which the top right's ink ends exactly where a printer stops reaching.
    const p = printPlacement('topRight', 429), right = inkBox(undefined, p.height, p.turn, p.flip).right;
    const width = 2 * (429 + p.fromEdge + right + 24) - 429;
    expect(width - ((width - 429) / 2 + p.x + right)).toBe(24);
    expect(printChoices('grid', { ...roomy(), paper: { width, height: 1056 }, cardTop: 400 }, undefined)).toEqual(['topRight']);
  });

  test('a one-grid sheet never starts lower: a spot whose head needs it is left out; a Saga\'s sheets keep it', () => {
    expect(printChoices('one', { ...roomy(), cardTop: 100 }, undefined)).toEqual(['right', 'left']);
    expect(printChoices('grid', { ...roomy(), cardTop: 100 }, undefined)).toEqual(['topRight', 'topLeft']);
    expect(printChoices('words', { ...roomy(), cardTop: 100 }, undefined)).toEqual(['topRight', 'topLeft']);
  });

  test('none fits, and the sheet picks from every one it has', () => {
    expect(printChoices('one', { ...roomy(), paper: { width: 300, height: 1056 } }, undefined)).toEqual(['right', 'left', 'topRight', 'topLeft']);
    expect(printChoices('words', { ...roomy(), paper: { width: 300, height: 1056 } }, undefined)).toEqual(['topRight', 'topLeft']);
  });
});

describe('printed Colour or Black and white: each time a sheet prints', () => {
  const owner = () => ({ name: 'Bunnosaur', figure: 'bunnosaur.webp', scene: 'bunnosaur-bg.webp', outline: lowHalf() });

  test('picks a spot at random from its choices, the first to the last', () => {
    expect(printDress('one', roomy(), owner(), () => 0).spot).toBe('right');
    expect(printDress('one', roomy(), owner(), () => 0.3).spot).toBe('left');
    expect(printDress('one', roomy(), owner(), () => 0.5).spot).toBe('topRight');
    expect(printDress('one', roomy(), owner(), () => 0.99).spot).toBe('topLeft');
  });

  test('draws it from the card edge it\'s held from: centred, turned, mirrored when flipped', () => {
    expect(printDress('one', roomy(), owner(), () => 0)).toEqual({
      spot: 'right', left: 'calc(100% + 10px)', top: '188px', height: '293px', transform: 'translate(-50%, -50%) rotate(37deg) scaleX(-1)', rise: '0px'
    });
    expect(printDress('one', roomy(), owner(), () => 0.99)).toEqual({
      spot: 'topLeft', left: 'calc(0% + 49px)', top: '-14px', height: '213px', transform: 'translate(-50%, -50%) rotate(12deg)', rise: '0px'
    });
  });

  test('carries the sheet\'s rise; a Saga\'s grid sheet starts lower for a head that needs it', () => {
    const rise = printRise('topLeft', { ...roomy(), cardTop: 100 }, undefined);
    expect(rise).toBeGreaterThan(0);
    expect(printDress('grid', { ...roomy(), cardTop: 100 }, { ...owner(), outline: undefined }, () => 0.99).rise).toBe(rise + 'px');
  });

  test('no character — the list couldn\'t be read — is judged as a whole image', () => {
    expect(printDress('one', { ...roomy(), cardTop: 100 }, undefined, () => 0.99).spot).toBe('left');
  });
});

describe('a phone', () => {
  test('is a window no wider than the play page\'s phone layout, 760px', () => {
    expect(isPhone(760)).toBe(true);
    expect(isPhone(761)).toBe(false);
  });
});

// TASK-146: the site wears the printout's four spots.
// The owner's 429 × 472 grid card, 1000 px in and 500 down the page, on a wide screen with nothing
// beside it: every spot shows. A words card, given, is the one other card that may cover it.
const onScreen = ({ words, ...over } = {}) => ({
  card: { left: 1000, top: 500, width: 429, height: 472 }, scale: 1, screen: { left: 0, right: 3000 },
  covers: [words].filter(Boolean), never: [], title: { left: 0, top: 0, width: 0, height: 0 },
  label: { width: 0, height: 0 }, saga: false, phone: false, ...over
});
// The box round a spot's whole-image ink on the page.
const inkOnPage = (spot, frame) => {
  const p = sitePlacement(spot, frame), ink = inkBox(undefined, p.height, p.turn, p.flip);
  return { left: p.left + ink.left, right: p.left + ink.right, top: p.top + ink.top, bottom: p.top + ink.bottom };
};
const spotOf = (frame, number, character) => siteDress(frame, character, number).spot;

describe('on screen: the spots a page picks from', () => {
  test('all four, but a Saga\'s play page and any page on a phone only the top corners', () => {
    expect(siteChoices(false, false)).toEqual(['right', 'left', 'topRight', 'topLeft']);
    expect(siteChoices(true, false)).toEqual(['topRight', 'topLeft']);
    expect(siteChoices(false, true)).toEqual(['topRight', 'topLeft']);
    expect(siteChoices(true, true)).toEqual(['topRight', 'topLeft']);
  });
});

describe('on screen: how big the play page draws the printout\'s picture', () => {
  test('its grid card against the card the puzzle prints on: the one-grid sheet\'s, or a Saga\'s grid sheet\'s', () => {
    expect(siteScale(2 * (396.85 + 32), 15, 15, 1, false)).toBeCloseTo(2, 9);
    expect(siteScale(15 * 36 + 32, 15, 15, 1, true)).toBe(1);
    expect(siteScale(8 * 54 + 32, 8, 8, 1.5, false)).toBe(1);
  });

  test('a maze: the card the spots were placed on, 429 × 472, fitted inside the maze card', () => {
    expect(mazeScale(429, 472)).toBe(1);
    expect(mazeScale(858, 472)).toBe(1);
    expect(mazeScale(429, 944)).toBe(1);
    expect(mazeScale(858, 1416)).toBe(2);
    expect(mazeScale(1287, 944)).toBe(2);
  });
});

describe('on screen: where the character stands', () => {
  test('on the owner\'s card at the printout\'s size, each spot where the printout has it, its label beside it', () => {
    const at = spot => {
      const p = sitePlacement(spot, onScreen());
      return [p.left, p.top, p.height, p.turn, p.flip, p.labelLeft - p.left, p.labelTop - p.top].map(n => typeof n === 'number' ? Math.round(n * 1000) / 1000 : n);
    };
    expect(at('right')).toEqual([1439, 688, 293, 37, true, 0.3 * 293, 0.52 * 293].map(n => typeof n === 'number' ? Math.round(n * 1000) / 1000 : n));
    expect(at('left')).toEqual([999, 671, 293, -41, false, -87.9, 152.36]);
    expect(at('topRight')).toEqual([1378, 487, 213, -3, true, 132.06, -10.65]);
    expect(at('topLeft')).toEqual([1049, 486, 213, 12, false, -132.06, -10.65]);
  });

  test('at twice the size, held from the card edge nearest it, twice as far from it, and twice as tall', () => {
    const frame = onScreen({ card: { left: 0, top: 0, width: 600, height: 300 }, scale: 2 });
    expect(sitePlacement('right', frame)).toMatchObject({ spot: 'right', left: 600 + 20, top: 376, height: 586 });
    expect(sitePlacement('topRight', frame)).toMatchObject({ left: 600 - 102, top: -26, height: 426 });
    expect(sitePlacement('left', frame)).toMatchObject({ left: -2, top: 342 });
    expect(sitePlacement('topLeft', frame)).toMatchObject({ left: 98, top: -28 });
  });

  test('the puzzle\'s number picks round the four, the same every visit', () => {
    expect([1, 2, 3, 4, 5, 50].map(n => spotOf(onScreen(), n))).toEqual(['right', 'left', 'topRight', 'topLeft', 'right', 'left']);
  });

  test('drawn centred on its spot, turned, mirrored when flipped, its name label beside it', () => {
    expect(siteDress(onScreen(), undefined, 4)).toEqual({
      spot: 'topLeft', left: '1049px', top: '486px', height: '213px', transform: 'translate(-50%, -50%) rotate(12deg)',
      label: true, labelLeft: 1049 - 0.62 * 213 + 'px', labelTop: 486 - 0.05 * 213 + 'px'
    });
  });

  test('is drawn centred on its spot and turned, mirrored only when flipped', () => {
    expect(figureTransform({ turn: -24, flip: false })).toBe('translate(-50%, -50%) rotate(-24deg)');
    expect(figureTransform({ turn: -24, flip: true })).toBe('translate(-50%, -50%) rotate(-24deg) scaleX(-1)');
  });

  test('a Saga picks round the top corners; a phone too, with no name label', () => {
    expect([1, 2, 3].map(n => spotOf(onScreen({ saga: true }), n))).toEqual(['topRight', 'topLeft', 'topRight']);
    expect([1, 2].map(n => spotOf(onScreen({ phone: true }), n))).toEqual(['topRight', 'topLeft']);
    expect(siteDress(onScreen({ phone: true }), undefined, 1).label).toBe(false);
  });
});

describe('on screen: a spot that doesn\'t show is skipped', () => {
  test('a side whose character, past the card, runs past the screen\'s edge — exactly at the edge still shows', () => {
    const right = inkOnPage('right', onScreen()).right, left = inkOnPage('left', onScreen()).left;
    expect(spotOf(onScreen({ screen: { left: 0, right } }), 1)).toBe('right');
    expect(spotOf(onScreen({ screen: { left: 0, right: right - 0.001 } }), 1)).toBe('left');
    expect(spotOf(onScreen({ screen: { left, right: 3000 } }), 2)).toBe('left');
    expect(spotOf(onScreen({ screen: { left: left + 0.001, right: 3000 } }), 2)).toBe('topRight');
  });

  test('a top corner whose character runs past either edge of the screen', () => {
    const topRight = inkOnPage('topRight', onScreen()), topLeft = inkOnPage('topLeft', onScreen());
    const phone = screen => [1, 2].map(n => spotOf(onScreen({ phone: true, screen }), n));
    expect(phone({ left: topLeft.left, right: topRight.right })).toEqual(['topRight', 'topLeft']);
    expect(phone({ left: topLeft.left, right: topRight.right - 0.001 })).toEqual(['topLeft', 'topLeft']);
    expect(phone({ left: topLeft.left + 0.001, right: 3000 })).toEqual(['topRight', 'topRight']);
  });

  test('judged by the character\'s inked outline, so a slimmer one shows where its whole image wouldn\'t', () => {
    const screen = { left: 0, right: inkOnPage('right', onScreen()).right - 1 };
    expect(spotOf(onScreen({ screen }), 1, undefined)).toBe('left');
    expect(spotOf(onScreen({ screen }), 1, { outline: lowHalf() })).toBe('right');
  });

  test('a side the words card beside the grid covers: with the words at the Right, the right two', () => {
    const words = { left: 1429 + 28, top: 500, width: 300, height: 472 };
    expect([1, 2, 3].map(n => spotOf(onScreen({ words }), n))).toEqual(['left', 'topLeft', 'left']);
  });

  test('the words card under a short grid covers the sides; over the grid it covers only what the grid card hides', () => {
    const short = { left: 1000, top: 500, width: 429, height: 200 };
    expect([1, 2].map(n => spotOf(onScreen({ card: short, words: { left: 1000, top: 714, width: 429, height: 400 } }), n))).toEqual(['topRight', 'topLeft']);
    expect([1, 2].map(n => spotOf(onScreen({ words: { left: 1000, top: 500, width: 429, height: 472 } }), n))).toEqual(['right', 'left']);
  });

  test('a words card only touching the character covers none of it', () => {
    const box = inkOnPage('right', onScreen());
    const touching = [
      { left: box.right, top: 0, width: 100, height: 2000 }, { left: box.left - 100, top: 0, width: 100, height: 2000 },
      { left: 0, top: box.bottom, width: 3000, height: 100 }, { left: 1500, top: box.top - 100, width: 3000, height: 100 }
    ];
    touching.forEach(words => expect(spotOf(onScreen({ words }), 1)).toBe('right'));
  });

  test('a words card covering it only where it stands behind the grid card, on any side, covers none of it', () => {
    const inside = [
      { left: 1000, top: 500, width: 1, height: 472 }, { left: 1428, top: 500, width: 1, height: 472 },
      { left: 1000, top: 500, width: 429, height: 1 }, { left: 1000, top: 971, width: 429, height: 1 }
    ];
    inside.forEach(words => expect([1, 2, 3, 4].map(n => spotOf(onScreen({ words }), n))).toEqual(['right', 'left', 'topRight', 'topLeft']));
    // On a shorter card the right side's ink reaches below it: a sliver on the card's foot is behind
    // the card; a pixel past it is not.
    const card = { left: 1000, top: 500, width: 429, height: 300 };
    expect(inkOnPage('right', onScreen({ card })).bottom).toBeGreaterThan(801);
    expect(spotOf(onScreen({ card, words: { left: 1300, top: 799, width: 100, height: 1 } }), 1)).toBe('right');
    expect(spotOf(onScreen({ card, words: { left: 1300, top: 799, width: 100, height: 2 } }), 1)).not.toBe('right');
  });

  test('a pixel past the grid card\'s edge, the words card covers the characters standing there', () => {
    const picks = words => [1, 2, 3, 4].map(n => spotOf(onScreen({ words }), n));
    // Past its left edge, by the left side and the top left's feet.
    expect(picks({ left: 999, top: 600, width: 2, height: 10 })).toEqual(['right', 'topRight', 'right', 'topRight']);
    // Past its right edge, by the right side.
    expect(picks({ left: 1428, top: 600, width: 2, height: 10 })).toEqual(['left', 'topRight', 'topLeft', 'left']);
    // Past its top edge, by the top left and the left side's head.
    expect(picks({ left: 1050, top: 499, width: 10, height: 2 })).toEqual(['right', 'topRight', 'right', 'topRight']);
    // Past its foot, where no character reaches.
    expect(picks({ left: 1400, top: 971, width: 10, height: 2 })).toEqual(['right', 'left', 'topRight', 'topLeft']);
  });

  test('a spot whose name label runs past the screen\'s edge — exactly at the edge still shows', () => {
    // The right side's label, 200 × 30, centred 87.9 px right of the character: past its ink.
    const label = { width: 200, height: 30 }, p = sitePlacement('right', onScreen());
    expect(p.labelLeft + 100).toBeGreaterThan(inkOnPage('right', onScreen()).right);
    expect(spotOf(onScreen({ label, screen: { left: 0, right: p.labelLeft + 100 } }), 1)).toBe('right');
    expect(spotOf(onScreen({ label, screen: { left: 0, right: p.labelLeft + 99.999 } }), 1)).toBe('left');
    // The top left's label, centred 132 px left of it: past its ink on the left.
    const q = sitePlacement('topLeft', onScreen());
    expect(q.labelLeft - 100).toBeLessThan(inkOnPage('topLeft', onScreen()).left);
    const phoneless = left => [1, 2].map(n => spotOf(onScreen({ label, saga: true, screen: { left, right: 3000 } }), n));
    expect(phoneless(q.labelLeft - 100)).toEqual(['topRight', 'topLeft']);
    expect(phoneless(q.labelLeft - 99.999)).toEqual(['topRight', 'topRight']);
  });

  test('a spot whose name label the words card covers, where the character itself is clear', () => {
    // A tall label, reaching below the character's ink; the words card a pixel into its foot.
    const label = { width: 200, height: 100 }, p = sitePlacement('right', onScreen());
    const under = { left: p.labelLeft - 10, top: p.labelTop + 49, width: 20, height: 100 };
    expect(under.top).toBeGreaterThan(inkOnPage('right', onScreen()).bottom);
    expect(spotOf(onScreen({ words: under }), 1)).toBe('right');
    expect(spotOf(onScreen({ label, words: { ...under, top: p.labelTop + 50 } }), 1)).toBe('right');
    expect(spotOf(onScreen({ label, words: under }), 1)).toBe('left');
    // Above it, past the character's ink: a words card ending at the label's top leaves it clear,
    // a pixel lower covers it.
    const right = inkOnPage('right', onScreen()).right;
    expect(p.labelLeft + 100).toBeGreaterThan(right + 1);
    const over = { left: right + 1, top: p.labelTop - 150, width: p.labelLeft + 100 - right - 1, height: 100 };
    expect(spotOf(onScreen({ label, words: over }), 1)).toBe('right');
    expect(spotOf(onScreen({ label, words: { ...over, height: 101 } }), 1)).toBe('left');
  });

  // TASK-104: a maze's checklist above its card and its control pad beside it, each a card.
  test('several other cards: a spot any one covers is skipped — a maze\'s checklist above, its pad beside', () => {
    const checklist = { left: 1000, top: 380, width: 429, height: 92 }, pad = { left: 1429 + 28, top: 500, width: 240, height: 344 };
    expect([1, 2, 3, 4].map(n => spotOf(onScreen({ covers: [checklist] }), n))).toEqual(['right', 'left', 'right', 'left']);
    expect([1, 2, 3, 4].map(n => spotOf(onScreen({ covers: [pad] }), n))).toEqual(['left', 'topLeft', 'left', 'topLeft']);
    expect([1, 2, 3].map(n => spotOf(onScreen({ covers: [checklist, pad] }), n))).toEqual(['left', 'left', 'left']);
    expect([1, 2, 3].map(n => spotOf(onScreen({ covers: [pad, checklist] }), n))).toEqual(['left', 'left', 'left']);
    expect([1, 2, 3, 4].map(n => spotOf(onScreen({ covers: [] }), n))).toEqual(['right', 'left', 'topRight', 'topLeft']);
  });

  test('none shows, and the page still keeps it out from behind the cards it must never stand behind', () => {
    // A screen no wider than the card: no character shows; the pad beside it covers the right two.
    const screen = { left: 1000, right: 1429 }, pad = { left: 1429 + 28, top: 500, width: 240, height: 344 };
    expect([1, 2, 3].map(n => spotOf(onScreen({ screen, covers: [pad], never: [pad] }), n))).toEqual(['left', 'topLeft', 'left']);
    expect(siteDress(onScreen({ screen, covers: [pad], never: [pad], label: { width: 200, height: 30 } }), undefined, 1).label).toBe(false);
    // Only a card it must never stand behind counts then; one that merely covers it doesn't.
    expect([1, 2, 3, 4].map(n => spotOf(onScreen({ screen, covers: [pad] }), n))).toEqual(['right', 'left', 'topRight', 'topLeft']);
    // Every spot behind one: round every one it has.
    const everywhere = { left: 0, top: 0, width: 3000, height: 2000 };
    expect([1, 2].map(n => spotOf(onScreen({ screen, never: [everywhere] }), n))).toEqual(['right', 'left']);
    expect(siteDress(onScreen({ screen, never: [everywhere], label: { width: 200, height: 30 } }), undefined, 1).label).toBe(false);
  });

  test('a box on the window, measured from the page\'s corner', () => {
    expect(boxFrom({ left: 300, top: 250, width: 40, height: 30, right: 340 }, { left: 100, top: 50 })).toEqual({ left: 200, top: 200, width: 40, height: 30 });
  });

  test('a spot whose character would rise over the title is passed over while another keeps clear of it', () => {
    // A title over the card's top-right corner: the top right's head reaches it.
    const title = { left: 1300, top: 300, width: 200, height: 80 };
    expect([1, 2, 3, 4].map(n => spotOf(onScreen({ title }), n))).toEqual(['right', 'left', 'topLeft', 'right']);
    // A title just clear of the top right's ink, on each side, takes nothing away.
    const ink = inkOnPage('topRight', onScreen());
    const beside = [
      { left: ink.right, top: 300, width: 100, height: 80 }, { left: ink.left - 100, top: 300, width: 100, height: 80 },
      { left: 1300, top: ink.top - 80, width: 200, height: 80 }, { left: 1300, top: ink.bottom, width: 200, height: 80 }
    ];
    beside.forEach(t => expect([1, 2, 3, 4].map(n => spotOf(onScreen({ title: t }), n))).toContain('topRight'));
  });

  test('its name label too keeps clear of the title', () => {
    const label = { width: 200, height: 30 }, p = sitePlacement('topRight', onScreen());
    const title = { left: p.labelLeft + 99, top: p.labelTop - 15, width: 100, height: 30 };
    expect(spotOf(onScreen({ title }), 3)).toBe('topRight');
    expect(spotOf(onScreen({ label, title }), 3)).toBe('topLeft');
    expect(spotOf(onScreen({ label, title: { ...title, left: p.labelLeft + 100 } }), 3)).toBe('topRight');
  });

  test('every spot would cover the title, and the page picks as though it weren\'t there', () => {
    const title = { left: 0, top: 0, width: 3000, height: 2000 };
    expect([1, 2, 3, 4].map(n => spotOf(onScreen({ title }), n))).toEqual(['right', 'left', 'topRight', 'topLeft']);
    expect(siteDress(onScreen({ title, label: { width: 200, height: 30 } }), undefined, 1).label).toBe(true);
    expect(siteDress(onScreen({ title, label: { width: 4000, height: 30 } }), undefined, 1).label).toBe(false);
  });

  test('clear of the title without its label wins over the label over the title', () => {
    // The label, wider than the screen, fits nowhere; without it only the top right clears the title.
    const title = { left: 0, top: 600, width: 3000, height: 2000 };
    const frame = onScreen({ title, label: { width: 4000, height: 30 } });
    expect(siteDress(frame, undefined, 1)).toMatchObject({ spot: 'topRight', label: false });
  });

  test('none shows with its name label, and the page picks from those that show without it, the label left off', () => {
    // A label wider than the screen fits no spot; the characters themselves all do.
    const frame = onScreen({ label: { width: 4000, height: 30 } });
    expect([1, 2, 3, 4].map(n => spotOf(frame, n))).toEqual(['right', 'left', 'topRight', 'topLeft']);
    expect(siteDress(frame, undefined, 1).label).toBe(false);
    expect(siteDress(onScreen({ label: { width: 200, height: 30 } }), undefined, 1).label).toBe(true);
    // Only the left side's character clears a screen edge 100 px into the card, label or no label.
    expect(inkOnPage('topLeft', onScreen()).right).toBeGreaterThan(1100);
    const tight = onScreen({ label: { width: 4000, height: 30 }, screen: { left: 0, right: 1100 } });
    expect([1, 2].map(n => spotOf(tight, n))).toEqual(['left', 'left']);
  });

  test('none shows even without its label, and the page picks from every one it has, the label left off', () => {
    const screen = { left: 1000, right: 1429 };
    expect([1, 2, 3, 4].map(n => spotOf(onScreen({ screen }), n))).toEqual(['right', 'left', 'topRight', 'topLeft']);
    expect([1, 2].map(n => spotOf(onScreen({ screen, phone: true }), n))).toEqual(['topRight', 'topLeft']);
    expect(siteDress(onScreen({ screen }), undefined, 1).label).toBe(false);
  });
});
