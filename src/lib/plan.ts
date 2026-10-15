import { MONTH_INDEX, SYDNEY_DAYS, YEAR, dayInfo } from '../data/december';
import { RESTAURANT_BY_ID } from '../data/restaurants';
import type { Booking, Meal, Restaurant } from '../data/types';
import { weekdayName, weekdayOf } from './calendar';

export const MEALS: { key: Meal; label: string; short: string }[] = [
  { key: 'lunch', label: '午餐', short: '午' },
  { key: 'dinner', label: '晚餐', short: '晚' },
];

/** Set once the table is actually booked; the time ("19:30") is optional. */
export interface Reservation {
  booked?: boolean;
  time?: string;
}

export type RestaurantPick = { kind: 'restaurant'; id: string } & Reservation;
export type CustomPick = { kind: 'custom'; name: string; note: string } & Reservation;

/** What the user chose for one meal: a restaurant from the list, or a place typed in by hand. */
export type Pick = RestaurantPick | CustomPick;

/** Picks keyed by day of month, then meal. */
export type Picks = Record<number, Partial<Record<Meal, Pick>>>;

export type MealEntry =
  | { status: 'booked'; booking: Booking }
  | { status: 'picked'; pick: RestaurantPick; restaurant: Restaurant }
  | { status: 'custom'; pick: CustomPick };

/** A booking from the trip, or a pick the user has marked as booked. */
export function isBooked(e: MealEntry): boolean {
  return e.status === 'booked' || e.pick.booked === true;
}

/** Resolves a meal slot. A real booking always wins over a pick. */
export function mealEntry(day: number, meal: Meal, picks: Picks): MealEntry | null {
  const booking = dayInfo(day).booked?.[meal];
  if (booking) return { status: 'booked', booking };
  const pick = picks[day]?.[meal];
  if (!pick) return null;
  if (pick.kind === 'custom') return { status: 'custom', pick };
  const restaurant = RESTAURANT_BY_ID.get(pick.id);
  return restaurant ? { status: 'picked', pick, restaurant } : null;
}

export function setPick(picks: Picks, day: number, meal: Meal, pick: Pick): Picks {
  return { ...picks, [day]: { ...picks[day], [meal]: pick } };
}

/** The same pick marked as booked, at an optional time like "19:30", or back to just picked. */
export function withReservation(pick: Pick, booked: boolean, time = ''): Pick {
  const next = { ...pick };
  delete next.booked;
  delete next.time;
  if (!booked) return next;
  next.booked = true;
  if (time) next.time = time;
  return next;
}

export function removePick(picks: Picks, day: number, meal: Meal): Picks {
  const forDay = { ...picks[day] };
  delete forDay[meal];
  const next = { ...picks };
  if (Object.keys(forDay).length) next[day] = forDay;
  else delete next[day];
  return next;
}

/** Sydney days whose given meal is still open. */
export function freeSydneyDays(meal: Meal, picks: Picks): number[] {
  return SYDNEY_DAYS.filter((d) => !mealEntry(d, meal, picks));
}

export function servesMeal(r: Restaurant, meal: Meal): boolean {
  return r.meals.includes(meal);
}

/** The meal to offer first: the preferred one if the restaurant serves it, else the other one if it does. */
export function defaultMeal(r: Restaurant, preferred: Meal): Meal {
  if (servesMeal(r, preferred)) return preferred;
  const other: Meal = preferred === 'lunch' ? 'dinner' : 'lunch';
  return servesMeal(r, other) ? other : preferred;
}

function closedWeekly(r: Restaurant, day: number): boolean {
  return r.closed?.includes(weekdayOf(YEAR, MONTH_INDEX, day)) ?? false;
}

/** Whether the restaurant is likely shut that day of December: a weekly closing day, or a date it has announced. */
export function closedOn(r: Restaurant, day: number): boolean {
  return closedWeekly(r, day) || (r.closedDates?.includes(day) ?? false);
}

/** Why it is likely shut that day, e.g. "周一通常休息" or "12月25日休息"; empty when it should be open. */
export function closedReason(r: Restaurant, day: number): string {
  if (r.closedDates?.includes(day)) return `12月${day}日休息`;
  if (closedWeekly(r, day)) return `${weekdayName(weekdayOf(YEAR, MONTH_INDEX, day))}通常休息`;
  return '';
}

/** "12月25、26、31日"; a run of three or more days reads "12月25日至31日". */
export function decemberDates(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const d of sorted) {
    const run = runs[runs.length - 1];
    if (run && d === run[run.length - 1] + 1) run.push(d);
    else runs.push([d]);
  }
  const parts = runs.flatMap((run) => (run.length >= 3 ? [`${run[0]}日至${run[run.length - 1]}日`] : run.map((d) => `${d}日`)));
  // "25日、26日" reads better as "25、26日" when every part is a single day.
  return runs.every((run) => run.length < 3) ? `12月${sorted.join('、')}日` : `12月${parts.join('、')}`;
}

/** "通常周一、周二休息；12月25日至31日休息", Monday first; empty when it opens every day or nobody checked. */
export function closedLabel(r: Restaurant): string {
  const parts: string[] = [];
  if (r.closed?.length) {
    const monFirst = [...r.closed].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    parts.push(`通常${monFirst.map(weekdayName).join('、')}休息`);
  }
  if (r.closedDates?.length) parts.push(`${decemberDates(r.closedDates)}休息`);
  return parts.join('；');
}

export function countMeals(picks: Picks, days: number): { booked: number; picked: number } {
  let booked = 0;
  let picked = 0;
  for (let d = 1; d <= days; d++) {
    for (const m of MEALS) {
      const e = mealEntry(d, m.key, picks);
      if (!e) continue;
      if (isBooked(e)) booked++;
      else picked++;
    }
  }
  return { booked, picked };
}

/** Where a restaurant already sits on the calendar, e.g. "12月3日 晚餐". */
export function placementsOf(id: string, picks: Picks): string[] {
  const out: string[] = [];
  for (const [day, meals] of Object.entries(picks)) {
    for (const m of MEALS) {
      const p = meals?.[m.key];
      if (p?.kind === 'restaurant' && p.id === id) out.push(`12月${day}日 ${m.label}`);
    }
  }
  return out;
}
