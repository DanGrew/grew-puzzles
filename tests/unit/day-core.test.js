import { dayLabel } from '../../core/day-core.js';

describe('day-core.js', () => {
  test('a created date reads day, short month, year, with no leading zero', () => {
    expect(dayLabel('2026-10-02')).toBe('2 Oct 2026');
    expect(dayLabel('2027-01-31')).toBe('31 Jan 2027');
  });

  test('every month has its own short name', () => {
    const months = Array.from({ length: 12 }, (_, i) => dayLabel(`2026-${String(i + 1).padStart(2, '0')}-15`).split(' ')[1]);
    expect(months).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });
});
