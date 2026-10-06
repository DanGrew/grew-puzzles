import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { entriesUrl, entriesJson, wordEntries, popupPlace, popupTap, popupKey, wordKey } from '../../core/entries-core.js';
const require = createRequire(import.meta.url);
const ENTRIES = require('../fixtures/entries.json');

// Built per test, never at load: the mutation runner doesn't reload this file between mutants.
let INDEX, GROUPS;
beforeEach(() => {
  INDEX = JSON.parse(JSON.stringify(ENTRIES));
  GROUPS = ['farm-animals', 'cafe-menu'];
});
const listed = (...texts) => texts.map(text => ({ text, copies: [0] }));

describe('the entries file', () => {
  it('is the one entries file beside the puzzles', () => {
    expect(entriesUrl()).toBe('../content/entries/index.json');
  });

  it('reads a fetched file as JSON', async () => {
    await expect(entriesJson({ ok: true, json: () => Promise.resolve({ groups: [1] }) })).resolves.toEqual({ groups: [1] });
  });

  it('reads no file as no entries at all', () => {
    expect(entriesJson({ ok: false, json: () => Promise.resolve({ groups: [1] }) })).toEqual({ groups: [] });
  });
});

describe("which listed words have an entry", () => {
  it('marks each word with an entry in the puzzle\'s groups, in list order, and leaves the rest unmarked', () => {
    const entries = wordEntries(INDEX, GROUPS, listed('Cat', 'Hen', 'Ice cream', 'Pig'));
    expect(entries.map(e => [e.word, e.marked])).toEqual([['Cat', true], ['Hen', false], ['Ice cream', true], ['Pig', false]]);
  });

  it('never marks a word from a group the puzzle doesn\'t name', () => {
    expect(wordEntries(INDEX, ['farm-animals'], listed('Ice cream', 'Pig')).map(e => e.marked)).toEqual([false, false]);
    expect(wordEntries(INDEX, ['fish'], listed('Pig'))[0].marked).toBe(true);
  });

  it('matches the word exactly as listed', () => {
    expect(wordEntries(INDEX, GROUPS, listed('cat', 'Cat ', 'Ice Cream')).map(e => e.marked)).toEqual([false, false, false]);
  });

  it("takes a word in two of the puzzle's groups from its first", () => {
    INDEX.groups[1].entries.push({ word: 'Cow', definition: 'A café: no, a cow.' });
    expect(wordEntries(INDEX, GROUPS, listed('Cow'))[0].definition).toBe('A large farm animal kept for its milk.');
    expect(wordEntries(INDEX, ['cafe-menu', 'farm-animals'], listed('Cow'))[0].definition).toBe('A café: no, a cow.');
  });

  it('skips a group of the puzzle\'s that has no entries', () => {
    expect(wordEntries(INDEX, ['no-such-group', 'cafe-menu'], listed('Ice cream'))[0].marked).toBe(true);
  });

  it('marks nothing when the site has no entries', () => {
    expect(wordEntries({ groups: [] }, GROUPS, listed('Cat', 'Cow')).map(e => e.marked)).toEqual([false, false]);
  });

  it('leaves an unmarked word with nothing to show', () => {
    expect(wordEntries(INDEX, GROUPS, listed('Hen'))[0]).toEqual({
      marked: false, word: 'Hen', definition: '', facts: [], hasFacts: false, credit: '', hasCredit: false, link: '', hasLink: false
    });
  });
});

describe('what a popup shows', () => {
  it('shows the word, its definition, its five facts labelled, its credit and its link', () => {
    expect(wordEntries(INDEX, GROUPS, listed('Cat'))[0]).toEqual({
      marked: true, word: 'Cat',
      definition: 'A small furry animal with whiskers, kept as a pet and for catching mice.',
      facts: [
        { label: 'Name', value: 'Domestic cat (Felis catus)' },
        { label: 'Habitat', value: 'Homes, farms and towns' },
        { label: 'Lifespan', value: '12 to 18 years' },
        { label: 'Food', value: 'Meat, fish and mice' },
        { label: 'Size', value: 'Up to 46 cm long, without the tail' }
      ],
      hasFacts: true,
      credit: 'From the Wikipedia article “Cat”, CC BY-SA 4.0', hasCredit: true,
      link: 'https://en.wikipedia.org/wiki/Cat', hasLink: true
    });
  });

  it('leaves out every part an entry hasn\'t got', () => {
    expect(wordEntries(INDEX, GROUPS, listed('Cow'))[0]).toEqual({
      marked: true, word: 'Cow', definition: 'A large farm animal kept for its milk.',
      facts: [], hasFacts: false, credit: '', hasCredit: false, link: '', hasLink: false
    });
  });

  it('lists the facts in their own order, whatever order the file holds them in, and only those written', () => {
    INDEX.groups[0].entries[1].facts = { size: 'Big', name: 'Cow (Bos taurus)' };
    expect(wordEntries(INDEX, GROUPS, listed('Cow'))[0].facts).toEqual([
      { label: 'Name', value: 'Cow (Bos taurus)' }, { label: 'Size', value: 'Big' }
    ]);
  });

  it('shows a link without a credit, and a credit without a link', () => {
    INDEX.groups[0].entries[1].link = 'https://en.wikipedia.org/wiki/Cattle';
    INDEX.groups[0].entries[2].credit = 'From Wikipedia';
    const [cow, goat] = wordEntries(INDEX, GROUPS, listed('Cow', 'Goat'));
    expect([cow.hasLink, cow.link, cow.hasCredit, cow.credit]).toEqual([true, 'https://en.wikipedia.org/wiki/Cattle', false, '']);
    expect([goat.hasLink, goat.link, goat.hasCredit, goat.credit]).toEqual([false, '', true, 'From Wikipedia']);
  });
});

describe('where the popup sits', () => {
  const VIEW = { width: 1200, height: 800 };
  const POPUP = { width: 300, height: 200 };
  const word = (left, top, width) => ({ left, top, right: left + width, bottom: top + 20 });

  it('sits 10px right of the word, its top level with the word\'s', () => {
    expect(popupPlace(word(100, 300, 50), POPUP, VIEW, false)).toEqual({ left: '160px', top: '300px' });
  });

  it('sits right while it ends at the window\'s 8px edge or before', () => {
    expect(popupPlace(word(800, 300, 82), POPUP, VIEW, false)).toEqual({ left: '892px', top: '300px' });
  });

  it('sits 10px left of the word when the right hasn\'t the room', () => {
    expect(popupPlace(word(800, 300, 83), POPUP, VIEW, false)).toEqual({ left: '490px', top: '300px' });
  });

  it('never runs past the window\'s left edge', () => {
    expect(popupPlace(word(100, 300, 900), POPUP, { width: 1100, height: 800 }, false)).toEqual({ left: '8px', top: '300px' });
  });

  it('never runs past the window\'s right edge, for a word scrolled past it', () => {
    expect(popupPlace(word(1250, 300, 40), POPUP, VIEW, false)).toEqual({ left: '892px', top: '300px' });
  });

  it('never runs above the window\'s top or below its foot', () => {
    expect(popupPlace(word(100, 2, 50), POPUP, VIEW, false).top).toBe('8px');
    expect(popupPlace(word(100, 700, 50), POPUP, VIEW, false).top).toBe('592px');
  });

  it('keeps to the top-left edge in a window smaller than the popup', () => {
    expect(popupPlace(word(100, 300, 50), POPUP, { width: 250, height: 150 }, false)).toEqual({ left: '8px', top: '8px' });
  });

  it('takes no place of its own on a phone', () => {
    expect(popupPlace(word(100, 300, 50), POPUP, VIEW, true)).toEqual({ left: '', top: '' });
  });
});

describe('taps and keys while a popup is open', () => {
  it('closes on a tap anywhere but the popup or a marked word', () => {
    expect(popupTap(true, false, false)).toBe('dismiss');
    expect(popupTap(true, true, false)).toBe('none');
    expect(popupTap(true, false, true)).toBe('none');
    expect(popupTap(true, true, true)).toBe('none');
  });

  it('leaves every tap alone while it is closed', () => {
    expect(popupTap(false, false, false)).toBe('none');
    expect(popupTap(false, false, true)).toBe('none');
  });

  it('closes on Esc while open, and on no other key', () => {
    expect(popupKey(true, 'Escape')).toBe('close');
    expect(popupKey(false, 'Escape')).toBe('none');
    expect(popupKey(true, 'Enter')).toBe('none');
  });

  it('opens a marked word on Enter or Space, and on no other key', () => {
    expect(wordKey('Enter')).toBe('open');
    expect(wordKey(' ')).toBe('open');
    expect(wordKey('Escape')).toBe('none');
    expect(wordKey('a')).toBe('none');
  });
});
