import {
  charactersFile, charactersOf, dressOf, sceneFile, figureFile, characterAt, characterFor, tileCharacter, randomCharacter, templateFor, themeScale,
  isPhone, wordsRoom, figurePlacement, figureTransform, wordsCap,
  printPaper, printCell, printCardWidth, printCardTop, printPlacement, inkBox, printRise, printChoices, printDress
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

describe('which template a puzzle wears', () => {
  test('beside, its mirror, the normal page — spread evenly by the hidden ID number', () => {
    expect(['WSCH-0001', 'WSCH-0002', 'WSCH-0003', 'WSCH-0004', 'WSCH-0050'].map(templateFor)).toEqual(['beside', 'mirror', 'normal', 'beside', 'mirror']);
  });
});

describe('a phone', () => {
  test('is a window no wider than the play page\'s phone layout, 760px', () => {
    expect(isPhone(760)).toBe(true);
    expect(isPhone(761)).toBe(false);
  });
});

describe('the room the words leave the character', () => {
  test('under the grid in beside and mirror, 240px and a 14px gap, only while Themed', () => {
    expect(wordsRoom('themed', 'beside', false)).toBe(254);
    expect(wordsRoom('themed', 'mirror', false)).toBe(254);
    expect(wordsRoom('themed', 'normal', false)).toBe(0);
    expect(['beside', 'mirror', 'normal'].map(t => wordsRoom('plain', t, false))).toEqual([0, 0, 0]);
  });

  test('none on a phone, where the words keep the grid card\'s width', () => {
    expect(['beside', 'mirror', 'normal'].map(t => wordsRoom('themed', t, true))).toEqual([0, 0, 0]);
  });
});

describe('where the character stands on the play page', () => {
  test('shrinks in proportion on a grid card narrower than 691px, never grows past it', () => {
    expect(themeScale(691)).toBe(1);
    expect(themeScale(1382)).toBe(1);
    expect(themeScale(345.5)).toBe(0.5);
  });

  test('at full size stands on the owner\'s spot from the grid card, its label on the owner\'s spot beside it', () => {
    expect(figurePlacement('beside', 'bottom', { width: 691, height: 733, left: 100, top: 50 }, false)).toEqual({
      left: 756, top: 1054, height: 700, turn: 0, flip: false, label: true, labelLeft: 756 - 0.156 * 700, labelTop: 1054 + 0.166 * 700
    });
  });

  test('on the owner\'s 691 × 733 grid card, every template and words position has its own spot, turn, facing and label spot', () => {
    const at = (template, sits) => {
      const p = figurePlacement(template, sits, { width: 691, height: 733, left: 0, top: 0 }, false);
      return [p.left, p.top, p.height, p.turn, p.flip, (p.labelLeft - p.left) / p.height, (p.labelTop - p.top) / p.height].map(n => typeof n === 'number' ? Math.round(n * 1000) / 1000 : n);
    };
    expect(at('beside', 'right')).toEqual([870, -29, 440, 0, false, 0.377, -0.107]);
    expect(at('beside', 'overlay')).toEqual([904, 732, 700, 0, false, -0.121, -0.389]);
    expect(at('mirror', 'bottom')).toEqual([15, 1030, 695, 0, true, -0.187, 0.039]);
    expect(at('mirror', 'right')).toEqual([256, -32, 385, 0, true, -0.322, -0.104]);
    expect(at('mirror', 'overlay')).toEqual([-190, 432, 635, 0, true, 0.036, -0.391]);
    expect(at('normal', 'bottom')).toEqual([719, 293, 560, 61, false, 0.143, 0.173]);
    expect(at('normal', 'right')).toEqual([275, -31, 455, -24, true, -0.376, -0.136]);
    expect(at('normal', 'overlay')).toEqual([-89, 309, 455, -90, false, -0.018, 0.341]);
  });

  test('on a wider, taller grid card, each spot keeps its offset from the card edges it was placed against, and its size', () => {
    // 1000 × 1500: 309 px wider and 767 px taller than the owner's card.
    const at = (template, sits) => {
      const p = figurePlacement(template, sits, { width: 1000, height: 1500, left: 0, top: 0 }, false);
      return [p.left, p.top, p.height];
    };
    expect(at('beside', 'bottom')).toEqual([656 + 309, 1004 + 767, 700]);
    expect(at('beside', 'right')).toEqual([870 + 309, -29, 440]);
    expect(at('beside', 'overlay')).toEqual([904 + 309, 732 + 767, 700]);
    expect(at('mirror', 'bottom')).toEqual([15, 1030 + 767, 695]);
    expect(at('mirror', 'right')).toEqual([256, -32, 385]);
    expect(at('mirror', 'overlay')).toEqual([-190, 432 + 767, 635]);
    expect(at('normal', 'bottom')).toEqual([719 + 309, 293, 560]);
    expect(at('normal', 'right')).toEqual([275, -31, 455]);
    expect(at('normal', 'overlay')).toEqual([-89, 309, 455]);
  });

  test('a tall grid keeps the character under it, not over its letters; a short one keeps it just under, not below the page', () => {
    expect(figurePlacement('mirror', 'bottom', { width: 691, height: 1221, left: 0, top: 0 }, false).top).toBe(1221 + 297);
    expect(figurePlacement('beside', 'bottom', { width: 691, height: 400, left: 0, top: 0 }, false).top).toBe(400 + 271);
  });

  test('on a smaller grid card, its offsets from the card edges and its size shrink with it; the card\'s own place does not', () => {
    const near = figurePlacement('normal', 'right', { width: 345.5, height: 400, left: 10, top: 20 }, false);
    expect(near).toMatchObject({ left: 10 + 137.5, top: 20 - 15.5, height: 227.5, turn: -24, flip: true, labelLeft: 147.5 - 0.376 * 227.5, labelTop: 4.5 - 0.136 * 227.5 });
    const far = figurePlacement('beside', 'bottom', { width: 345.5, height: 400, left: 10, top: 20 }, false);
    expect(far).toMatchObject({ left: 10 + 345.5 - 17.5, top: 20 + 400 + 135.5, height: 350 });
  });

  test('on a phone, every template and words position stands it in one spot, facing left, with no label', () => {
    ['beside', 'mirror', 'normal'].forEach(template => ['bottom', 'right', 'overlay'].forEach(sits => {
      expect(figurePlacement(template, sits, { width: 422, height: 900, left: 16, top: 200 }, true))
        .toEqual({ left: 385, top: 201, height: 140, turn: 0, flip: false, label: false, labelLeft: 385, labelTop: 201 });
    }));
  });

  test('on a phone, a grid card narrower than its 422px shrinks the spot with it, never grows past it', () => {
    expect(figurePlacement('beside', 'bottom', { width: 211, height: 400, left: 0, top: 0 }, true)).toMatchObject({ left: 184.5, top: 0.5, height: 70 });
    expect(figurePlacement('beside', 'bottom', { width: 844, height: 1600, left: 0, top: 0 }, true)).toMatchObject({ left: 369, top: 1, height: 140 });
  });

  test('is drawn centred on its spot and turned, mirrored only when flipped', () => {
    expect(figureTransform({ turn: -24, flip: false })).toBe('translate(-50%, -50%) rotate(-24deg)');
    expect(figureTransform({ turn: -24, flip: true })).toBe('translate(-50%, -50%) rotate(-24deg) scaleX(-1)');
  });

  test('caps the words card under the grid at the character\'s height, and not at all on a phone', () => {
    expect(wordsCap({ height: 347.5 }, false)).toBe('347.5px');
    expect(wordsCap({ height: 140 }, true)).toBe('none');
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
    expect(printCell(15, 15, false)).toBeCloseTo(396.85 / 15, 5);
    expect(printCell(15, 15, true)).toBe(36);
    expect(printCell(8, 30, true)).toBeCloseTo(755.91 / 30, 5);
  });

  test('a cell is 14 pt at the least, never wider than the sheet\'s 7.5 in across, never over 36 px, never wider than 165 mm a row', () => {
    expect(printCell(30, 30, false)).toBe(18.67);
    expect(printCell(40, 10, false)).toBe(18);
    expect(printCell(5, 5, false)).toBe(36);
    expect(printCell(20, 5, false)).toBeCloseTo(623.62 / 20, 5);
  });

  test('the card a character peers from: a grid card is its cells and 32 px; a words card the paper less its half-inch edges', () => {
    expect(printCardWidth('one', 15, 15, printPaper(false))).toBeCloseTo(396.85 + 32, 5);
    expect(printCardWidth('grid', 15, 15, printPaper(false))).toBe(15 * 36 + 32);
    expect(printCardWidth('words', 15, 15, printPaper(false))).toBe(794 - 96);
    expect(printCardWidth('words', 15, 15, printPaper(true))).toBe(816 - 96);
  });

  test('its top sits under the half-inch edge, the title and its 16 px — a words sheet 20 px more, a grid sheet\'s title without its date — and in the book under the puzzle\'s number', () => {
    expect([printCardTop('one', false), printCardTop('words', false), printCardTop('grid', false)]).toEqual([140, 160, 121]);
    expect([printCardTop('one', true), printCardTop('words', true), printCardTop('grid', true)]).toEqual([169, 189, 150]);
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
