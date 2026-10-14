import { sizeScale, sizeMenu, sizeSwatch, savedSize, saveSize } from '../../core/size-core.js';

describe('the size every kind shares', () => {
  it('scales the wordsearch by its letters against Normal\'s 22px', () => {
    expect(sizeScale('wordsearch', 'tiny')).toBe(10 / 22);
    expect(sizeScale('wordsearch', 'small')).toBe(15 / 22);
    expect(sizeScale('wordsearch', 'normal')).toBe(1);
    expect(sizeScale('wordsearch', 'large')).toBe(27 / 22);
    expect(sizeScale('wordsearch', 'huge')).toBe(32 / 22);
  });

  // TASK-186: the maze starts two rungs up, so its Tiny is the maze page as it was.
  it('scales the maze two rungs up the ladder, its Tiny today\'s page and Huge 42 over 22', () => {
    expect(sizeScale('maze', 'tiny')).toBe(1);
    expect(sizeScale('maze', 'small')).toBe(27 / 22);
    expect(sizeScale('maze', 'normal')).toBe(32 / 22);
    expect(sizeScale('maze', 'large')).toBe(37 / 22);
    expect(sizeScale('maze', 'huge')).toBe(42 / 22);
  });

  it('lists Tiny, Small, Normal, Large, Huge, smallest first, ticking the one picked', () => {
    expect(sizeMenu('large')).toEqual([
      { size: 'tiny', label: 'Tiny', picked: false },
      { size: 'small', label: 'Small', picked: false },
      { size: 'normal', label: 'Normal', picked: false },
      { size: 'large', label: 'Large', picked: true },
      { size: 'huge', label: 'Huge', picked: false }
    ]);
  });

  it('draws a square beside each size, growing with it', () => {
    expect(['tiny', 'small', 'normal', 'large', 'huge'].map(sizeSwatch)).toEqual([15, 19, 24, 28, 31]);
  });

  it('uses the size last stored on this device', () => {
    ['tiny', 'small', 'normal', 'large', 'huge'].forEach(size => {
      expect(savedSize(() => size)).toBe(size);
    });
  });

  it('starts at Normal on a first visit, or when the stored size is unknown', () => {
    [null, '', 'medium', 'Tiny', 'toString'].forEach(saved => {
      expect(savedSize(() => saved)).toBe('normal');
    });
  });

  it('falls back to Normal when the page cannot read the stored size', () => {
    expect(savedSize(() => { throw new Error('blocked'); })).toBe('normal');
  });

  it('stores the size, and carries on when the page cannot', () => {
    const stored = [];
    expect(saveSize(size => stored.push(size), 'huge')).toBe(true);
    expect(stored).toEqual(['huge']);
    expect(saveSize(() => { throw new Error('blocked'); }, 'huge')).toBe(false);
  });
});
