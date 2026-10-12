import { SYDNEY_DAYS, dayInfo } from '../data/december';
import { RESTAURANT_BY_ID } from '../data/restaurants';
import type { Booking, Meal, Restaurant } from '../data/types';

export const MEALS: { key: Meal; label: string; short: string }[] = [
  { key: 'lunch', label: '午餐', short: '午' },
  { key: 'dinner', label: '晚餐', short: '晚' },
];

/** What the user chose for one meal: a restaurant from the list, or a place typed in by hand. */
export type Pick = { kind: 'restaurant'; id: string } | { kind: 'custom'; name: string; note: string };

/** Picks keyed by day of month, then meal. */
export type Picks = Record<number, Partial<Record<Meal, Pick>>>;

export type MealEntry =
  | { status: 'booked'; booking: Booking }
  | { status: 'picked'; pick: { kind: 'restaurant'; id: string }; restaurant: Restaurant }
  | { status: 'custom'; pick: { kind: 'custom'; name: string; note: string } };

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

export function countMeals(picks: Picks, days: number): { booked: number; picked: number } {
  let booked = 0;
  let picked = 0;
  for (let d = 1; d <= days; d++) {
    for (const m of MEALS) {
      const e = mealEntry(d, m.key, picks);
      if (!e) continue;
      if (e.status === 'booked') booked++;
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
