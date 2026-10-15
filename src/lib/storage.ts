import { RESTAURANT_BY_ID } from '../data/restaurants';
import type { Meal } from '../data/types';
import type { Pick, Picks, Reservation } from './plan';
import type { SlotChange } from './sync';

export const STORAGE_KEY = 'sydney-eats:picks:v1';

const MEAL_KEYS: Meal[] = ['lunch', 'dinner'];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Only `booked: true` counts, and a time only alongside it. */
function cleanReservation(v: Record<string, unknown>): Reservation {
  if (v.booked !== true) return {};
  return typeof v.time === 'string' && TIME.test(v.time) ? { booked: true, time: v.time } : { booked: true };
}

export function cleanPick(value: unknown): Pick | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.kind === 'restaurant' && typeof v.id === 'string' && RESTAURANT_BY_ID.has(v.id)) {
    return { kind: 'restaurant', id: v.id, ...cleanReservation(v) };
  }
  if (v.kind === 'custom' && typeof v.name === 'string' && v.name.trim()) {
    return {
      kind: 'custom',
      name: v.name.trim().slice(0, 80),
      note: typeof v.note === 'string' ? v.note.slice(0, 200) : '',
      ...cleanReservation(v),
    };
  }
  return null;
}

/** Parses stored picks, dropping anything malformed or pointing at a restaurant that no longer exists. */
export function parsePicks(text: string | null): Picks {
  if (!text) return {};
  try {
    return sanitizePicks(JSON.parse(text));
  } catch {
    return {};
  }
}

/** Keeps only well-formed picks for real days, meals and restaurants. */
export function sanitizePicks(data: unknown): Picks {
  if (!data || typeof data !== 'object') return {};
  const out: Picks = {};
  for (const [key, meals] of Object.entries(data as Record<string, unknown>)) {
    const day = Number(key);
    if (!Number.isInteger(day) || day < 1 || day > 31 || !meals || typeof meals !== 'object') continue;
    for (const meal of MEAL_KEYS) {
      const pick = cleanPick((meals as Record<string, unknown>)[meal]);
      if (pick) out[day] = { ...out[day], [meal]: pick };
    }
  }
  return out;
}

export function loadPicks(): Picks {
  try {
    return parsePicks(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

export function savePicks(picks: Picks): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  } catch {
    // Private mode or blocked storage: picks just won't survive a reload.
  }
}

/** Changes that haven't reached the shared plan yet, so a reload still sends them. */
export const PENDING_KEY = 'sydney-eats:pending:v1';

/**
 * Parses stored pending changes, keeping only real slots. `pick: null` is a deliberate clear; a pick that no
 * longer checks out (say, a restaurant since dropped from the list) is skipped rather than sent as a clear.
 */
export function parsePending(text: string | null): SlotChange[] {
  if (!text) return [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: SlotChange[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const { day, meal, pick: raw } = item as Record<string, unknown>;
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 31) continue;
    const slot = MEAL_KEYS.find((m) => m === meal);
    const pick = raw === null ? null : cleanPick(raw);
    if (!slot || (raw !== null && !pick)) continue;
    out.push({ day, meal: slot, pick });
  }
  return out;
}

export function loadPending(): SlotChange[] {
  try {
    return parsePending(window.localStorage.getItem(PENDING_KEY));
  } catch {
    return [];
  }
}

export function savePending(changes: SlotChange[]): void {
  try {
    if (changes.length) window.localStorage.setItem(PENDING_KEY, JSON.stringify(changes));
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Blocked storage: pending changes are still sent, they just won't survive a reload.
  }
}
