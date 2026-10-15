const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];

/** Column headers for a Monday-first week. */
export const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];

export interface GridCell {
  /** Day of month shown in the cell. */
  day: number;
  /** False for the leading/trailing days that belong to the neighbouring months. */
  inMonth: boolean;
}

/** 0 = Sunday … 6 = Saturday, computed in UTC so the local timezone never shifts it. */
export function weekdayOf(year: number, monthIndex: number, day: number): number {
  return new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
}

export function daysIn(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** "周五" for 5. */
export function weekdayName(weekday: number): string {
  return `周${WEEKDAY_ZH[weekday]}`;
}

/** "12月4日 周五" */
export function dateLabel(year: number, monthIndex: number, day: number): string {
  return `${monthIndex + 1}月${day}日 周${WEEKDAY_ZH[weekdayOf(year, monthIndex, day)]}`;
}

/**
 * Monday-first month grid padded with the neighbouring months' days so every
 * row has seven cells.
 */
export function monthGrid(year: number, monthIndex: number): GridCell[] {
  const total = daysIn(year, monthIndex);
  const lead = (weekdayOf(year, monthIndex, 1) + 6) % 7;
  const prevTotal = daysIn(year, monthIndex - 1);
  const cells: GridCell[] = [];
  for (let i = lead; i > 0; i--) cells.push({ day: prevTotal - i + 1, inMonth: false });
  for (let d = 1; d <= total; d++) cells.push({ day: d, inMonth: true });
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ day: next++, inMonth: false });
  return cells;
}
