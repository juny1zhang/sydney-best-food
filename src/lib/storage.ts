import { RESTAURANT_BY_ID } from '../data/restaurants';
import type { Meal } from '../data/types';
import type { Pick, Picks } from './plan';

export const STORAGE_KEY = 'sydney-eats:picks:v1';

const MEAL_KEYS: Meal[] = ['lunch', 'dinner'];

function cleanPick(value: unknown): Pick | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.kind === 'restaurant' && typeof v.id === 'string' && RESTAURANT_BY_ID.has(v.id)) {
    return { kind: 'restaurant', id: v.id };
  }
  if (v.kind === 'custom' && typeof v.name === 'string' && v.name.trim()) {
    return { kind: 'custom', name: v.name.trim().slice(0, 80), note: typeof v.note === 'string' ? v.note.slice(0, 200) : '' };
  }
  return null;
}

/** Parses stored picks, dropping anything malformed or pointing at a restaurant that no longer exists. */
export function parsePicks(text: string | null): Picks {
  if (!text) return {};
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {};
  }
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
