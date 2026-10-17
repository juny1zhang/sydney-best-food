import { PLACE_BY_ID } from '../data/places';
import type { Meal } from '../data/types';
import type { Pick, Picks, Reservation } from './plan';

export const STORAGE_KEY = 'sydney-eats:picks:v1';
export const WISHLIST_KEY = 'sydney-eats:wishlist:v1';

const MEAL_KEYS: Meal[] = ['lunch', 'dinner'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanReservation(value: unknown): Reservation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.time !== 'string' || !TIME.test(v.time)) return undefined;
  return { time: v.time, note: typeof v.note === 'string' ? v.note.slice(0, 200) : '' };
}

function cleanPick(value: unknown): Pick | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const reserved = cleanReservation(v.reserved);
  if (v.kind === 'restaurant' && typeof v.id === 'string' && PLACE_BY_ID.has(v.id)) {
    return reserved ? { kind: 'restaurant', id: v.id, reserved } : { kind: 'restaurant', id: v.id };
  }
  if (v.kind === 'custom' && typeof v.name === 'string' && v.name.trim()) {
    const pick: Pick = { kind: 'custom', name: v.name.trim().slice(0, 80), note: typeof v.note === 'string' ? v.note.slice(0, 200) : '' };
    return reserved ? { ...pick, reserved } : pick;
  }
  return null;
}

/** Turns untrusted data (storage, a shared link) into picks, dropping anything malformed or unknown. */
export function cleanPicks(data: unknown): Picks {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
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

/** Parses stored picks, dropping anything malformed or pointing at a place that no longer exists. */
export function parsePicks(text: string | null): Picks {
  if (!text) return {};
  try {
    return cleanPicks(JSON.parse(text));
  } catch {
    return {};
  }
}

/** Keeps known place ids only, without duplicates. */
export function cleanWishlist(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return [...new Set(data.filter((id): id is string => typeof id === 'string' && PLACE_BY_ID.has(id)))];
}

export function parseWishlist(text: string | null): string[] {
  if (!text) return [];
  try {
    return cleanWishlist(JSON.parse(text));
  } catch {
    return [];
  }
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: changes just won't survive a reload.
  }
}

export function loadPicks(): Picks {
  return parsePicks(read(STORAGE_KEY));
}

export function savePicks(picks: Picks): void {
  write(STORAGE_KEY, picks);
}

export function loadWishlist(): string[] {
  return parseWishlist(read(WISHLIST_KEY));
}

export function saveWishlist(ids: string[]): void {
  write(WISHLIST_KEY, ids);
}
