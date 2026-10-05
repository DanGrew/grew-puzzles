import {
  charactersFile, charactersOf, dressOf, characterAt, characterFor, tileCharacter, randomCharacter, templateFor, themeScale,
  isPhone, wordsRoom, figurePlacement, figureTransform
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
});
