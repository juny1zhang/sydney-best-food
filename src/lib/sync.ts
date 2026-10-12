import { createClient } from '@supabase/supabase-js';
import type { Meal } from '../data/types';
import { MEALS, removePick, setPick, type Pick, type Picks } from './plan';
import { cleanPick } from './storage';

/** The one shared plan this site edits; the table only accepts this id. */
export const PLAN_ID = 'dec-2026';
const TABLE = 'picks';

/** A new value for one meal slot; `pick: null` clears it. */
export interface SlotChange {
  day: number;
  meal: Meal;
  pick: Pick | null;
}

/** Where the shared plan lives. Tests swap in a fake. */
export interface PicksRemote {
  fetchAll(): Promise<Picks>;
  write(change: SlotChange): Promise<void>;
  /** Streams every change to the plan; `onLive` reports whether the stream is connected. */
  subscribe(onChange: (change: SlotChange) => void, onLive: (live: boolean) => void): () => void;
}

export const slotKey = (day: number, meal: Meal) => `${day}:${meal}`;

function samePick(a: Pick | undefined, b: Pick | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'restaurant') return b.kind === 'restaurant' && a.id === b.id;
  return b.kind === 'custom' && a.name === b.name && a.note === b.note;
}

/** The slots whose pick differs between two plans. */
export function diffPicks(prev: Picks, next: Picks): SlotChange[] {
  const out: SlotChange[] = [];
  for (let day = 1; day <= 31; day++) {
    for (const { key: meal } of MEALS) {
      const a = prev[day]?.[meal];
      const b = next[day]?.[meal];
      if (!samePick(a, b)) out.push({ day, meal, pick: b ?? null });
    }
  }
  return out;
}

export function applyChange(picks: Picks, { day, meal, pick }: SlotChange): Picks {
  if (samePick(picks[day]?.[meal], pick ?? undefined)) return picks;
  return pick ? setPick(picks, day, meal, pick) : removePick(picks, day, meal);
}

/** Reads a table row (or a delete event's key columns), rejecting anything that isn't a real slot. */
export function rowToChange(row: Record<string, unknown> | null | undefined): SlotChange | null {
  if (!row || (row.plan_id !== undefined && row.plan_id !== PLAN_ID)) return null;
  const day = row.day;
  const meal = MEALS.find((m) => m.key === row.meal)?.key;
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 31 || !meal) return null;
  return { day, meal, pick: cleanPick(row.pick) };
}

export function createSupabaseRemote(url: string, key: string): PicksRemote {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async fetchAll() {
      const { data, error } = await db.from(TABLE).select('day, meal, pick').eq('plan_id', PLAN_ID);
      if (error) throw error;
      let picks: Picks = {};
      for (const row of data) {
        const change = rowToChange(row);
        if (change) picks = applyChange(picks, change);
      }
      return picks;
    },
    async write({ day, meal, pick }) {
      const { error } = pick
        ? await db.from(TABLE).upsert({ plan_id: PLAN_ID, day, meal, pick })
        : await db.from(TABLE).delete().match({ plan_id: PLAN_ID, day, meal });
      if (error) throw error;
    },
    subscribe(onChange, onLive) {
      // No server-side filter: Postgres can't filter delete events, and the table only holds this plan.
      const channel = db
        .channel(`picks:${PLAN_ID}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
          const deleted = payload.eventType === 'DELETE';
          const change = rowToChange(deleted ? payload.old : payload.new);
          if (change) onChange(deleted ? { ...change, pick: null } : change);
        })
        .subscribe((status) => onLive(status === 'SUBSCRIBED'));
      return () => void db.removeChannel(channel);
    },
  };
}

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** The site's shared plan, or null when no backend is configured (tests, offline dev). */
export const sharedRemote: PicksRemote | null = url && key ? createSupabaseRemote(url, key) : null;
