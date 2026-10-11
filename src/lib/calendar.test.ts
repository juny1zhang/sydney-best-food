import { dateLabel, daysIn, monthGrid, weekdayOf } from './calendar';

describe('calendar', () => {
  it('knows December 2026 starts on a Tuesday and Christmas is a Friday', () => {
    expect(weekdayOf(2026, 11, 1)).toBe(2);
    expect(weekdayOf(2026, 11, 25)).toBe(5);
    expect(daysIn(2026, 11)).toBe(31);
  });

  it('builds a Monday-first grid padded with neighbouring months', () => {
    const cells = monthGrid(2026, 11);
    expect(cells).toHaveLength(35);
    expect(cells[0]).toEqual({ day: 30, inMonth: false });
    expect(cells[1]).toEqual({ day: 1, inMonth: true });
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
    expect(cells.slice(-3)).toEqual([
      { day: 1, inMonth: false },
      { day: 2, inMonth: false },
      { day: 3, inMonth: false },
    ]);
  });

  it('formats dates in Chinese', () => {
    expect(dateLabel(2026, 11, 4)).toBe('12月4日 周五');
    expect(dateLabel(2026, 11, 6)).toBe('12月6日 周日');
  });
});
