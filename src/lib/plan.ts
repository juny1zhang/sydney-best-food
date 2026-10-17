import { DAYS_IN_MONTH, SYDNEY_DAYS, dayInfo } from '../data/december';
import { placeById } from '../data/places';
import type { Booking, Meal, Place, ServiceMeal } from '../data/types';

export const MEALS: { key: Meal; label: string; short: string; defaultTime: string }[] = [
  { key: 'lunch', label: '午餐', short: '午', defaultTime: '12:30' },
  { key: 'dinner', label: '晚餐', short: '晚', defaultTime: '19:00' },
];

export function mealLabel(meal: Meal): string {
  return MEALS.find((m) => m.key === meal)!.label;
}

/** A table the user has actually booked for a pick. */
export interface Reservation {
  /** "HH:MM", local time where the meal happens. */
  time: string;
  note: string;
}

/** What the user chose for one meal: a listed place, or a place typed in by hand. */
export type Pick =
  | { kind: 'restaurant'; id: string; reserved?: Reservation }
  | { kind: 'custom'; name: string; note: string; reserved?: Reservation };

/** Picks keyed by day of month, then meal. */
export type Picks = Record<number, Partial<Record<Meal, Pick>>>;

export type MealEntry =
  /** A booking made outside the site (the New Zealand trip). */
  | { status: 'booked'; booking: Booking }
  | { status: 'picked'; pick: Extract<Pick, { kind: 'restaurant' }>; place: Place; reserved?: Reservation }
  | { status: 'custom'; pick: Extract<Pick, { kind: 'custom' }>; reserved?: Reservation };

/** Resolves a meal slot. A trip booking always wins over a pick. */
export function mealEntry(day: number, meal: Meal, picks: Picks): MealEntry | null {
  const booking = dayInfo(day).booked?.[meal];
  if (booking) return { status: 'booked', booking };
  const pick = picks[day]?.[meal];
  if (!pick) return null;
  if (pick.kind === 'custom') return { status: 'custom', pick, reserved: pick.reserved };
  const place = placeById(pick.id);
  return place ? { status: 'picked', pick, place, reserved: pick.reserved } : null;
}

/** True when a table is secured: a trip booking, or a pick marked as reserved. */
export function isReserved(e: MealEntry): boolean {
  return e.status === 'booked' || !!e.reserved;
}

/** The reserved time, if any. */
export function reservedTime(e: MealEntry): string | null {
  if (e.status === 'booked') return e.booking.time;
  return e.reserved?.time ?? null;
}

export function entryName(e: MealEntry): string {
  if (e.status === 'booked') return e.booking.venue.name;
  if (e.status === 'picked') return e.place.name;
  return e.pick.name;
}

export function entryCategory(e: MealEntry): string {
  if (e.status === 'booked') return e.booking.venue.categoryLabel;
  if (e.status === 'picked') return e.place.categoryShort;
  return '自己记的';
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

/** Marks a pick as reserved (or clears the mark with null). No-op for empty slots. */
export function setReservation(picks: Picks, day: number, meal: Meal, reserved: Reservation | null): Picks {
  const pick = picks[day]?.[meal];
  if (!pick) return picks;
  const next = { ...pick };
  if (reserved) next.reserved = reserved;
  else delete next.reserved;
  return setPick(picks, day, meal, next);
}

/** Sydney days whose given meal is still open. */
export function freeSydneyDays(meal: Meal, picks: Picks): number[] {
  return SYDNEY_DAYS.filter((d) => !mealEntry(d, meal, picks));
}

export function servesMeal(place: { meals: ServiceMeal[] }, meal: Meal): boolean {
  return place.meals.includes(meal);
}

export interface PlanItem {
  day: number;
  meal: Meal;
  entry: MealEntry;
}

/** Every planned meal in date order. */
export function planItems(picks: Picks): PlanItem[] {
  const out: PlanItem[] = [];
  for (let day = 1; day <= DAYS_IN_MONTH; day++) {
    for (const m of MEALS) {
      const entry = mealEntry(day, m.key, picks);
      if (entry) out.push({ day, meal: m.key, entry });
    }
  }
  return out;
}

/** Meals with a table secured, and meals chosen but not booked yet. */
export function countMeals(picks: Picks): { booked: number; picked: number } {
  let booked = 0;
  let picked = 0;
  for (const item of planItems(picks)) {
    if (isReserved(item.entry)) booked++;
    else picked++;
  }
  return { booked, picked };
}
