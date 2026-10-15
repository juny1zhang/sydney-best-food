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

/** Whether the restaurant is usually closed on that day of December, going by its weekly closing days. */
export function closedOn(r: Restaurant, day: number): boolean {
  return r.closed?.includes(weekdayOf(YEAR, MONTH_INDEX, day)) ?? false;
}

/** "周一、周二休息", Monday first; empty when it opens every day or nobody checked. */
export function closedLabel(r: Restaurant): string {
  if (!r.closed?.length) return '';
  const monFirst = [...r.closed].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return `${monFirst.map(weekdayName).join('、')}休息`;
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
