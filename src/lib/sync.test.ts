import type { SupabaseClient } from '@supabase/supabase-js';
import { RESTAURANTS } from '../data/restaurants';
import { sendFeedback } from './feedback';
import { loadSupabase } from './supabase';
import { PLAN_ID, applyChange, createSupabaseRemote, diffPicks, rowToChange, sharedRemote } from './sync';

const id = RESTAURANTS[0].id;
const other = RESTAURANTS[1].id;

describe('sync', () => {
  it('never connects tests to the real shared plan', () => {
    expect(sharedRemote).toBeNull();
    expect(loadSupabase).toBeNull();
    expect(sendFeedback).toBeNull();
  });

  it('diffs only the slots that changed', () => {
    const prev = { 4: { dinner: { kind: 'restaurant' as const, id } }, 9: { lunch: { kind: 'custom' as const, name: '小馆', note: '' } } };
    const next = { 4: { dinner: { kind: 'restaurant' as const, id: other } }, 9: { lunch: { kind: 'custom' as const, name: '小馆', note: '' } }, 22: { lunch: { kind: 'restaurant' as const, id } } };
    expect(diffPicks(prev, next)).toEqual([
      { day: 4, meal: 'dinner', pick: { kind: 'restaurant', id: other } },
      { day: 22, meal: 'lunch', pick: { kind: 'restaurant', id } },
    ]);
    expect(diffPicks(next, {})).toHaveLength(3);
    expect(diffPicks(next, next)).toEqual([]);
    const booked = { ...next, 4: { dinner: { kind: 'restaurant' as const, id: other, booked: true, time: '19:00' } } };
    expect(diffPicks(next, booked)).toEqual([{ day: 4, meal: 'dinner', pick: booked[4].dinner }]);
  });

  it('applies a change, keeping the same object when nothing moves', () => {
    const picks = applyChange({}, { day: 5, meal: 'lunch', pick: { kind: 'restaurant', id } });
    expect(picks).toEqual({ 5: { lunch: { kind: 'restaurant', id } } });
    expect(applyChange(picks, { day: 5, meal: 'lunch', pick: { kind: 'restaurant', id } })).toBe(picks);
    expect(applyChange(picks, { day: 5, meal: 'lunch', pick: null })).toEqual({});
  });

  it('reads rows and delete keys, rejecting anything that is not a real slot', () => {
    expect(rowToChange({ plan_id: PLAN_ID, day: 3, meal: 'dinner', pick: { kind: 'restaurant', id } })).toEqual({
      day: 3,
      meal: 'dinner',
      pick: { kind: 'restaurant', id },
    });
    expect(rowToChange({ plan_id: PLAN_ID, day: 3, meal: 'dinner' })).toEqual({ day: 3, meal: 'dinner', pick: null });
    expect(rowToChange({ plan_id: 'other', day: 3, meal: 'dinner' })).toBeNull();
    expect(rowToChange({ day: 0, meal: 'dinner' })).toBeNull();
    expect(rowToChange({ day: 3, meal: 'brunch' })).toBeNull();
    expect(rowToChange(null)).toBeNull();
  });
});

type Handler = (payload: Record<string, unknown>) => void;
type Status = (status: string) => void;

/** Just enough of a Supabase client for the remote. */
function fakeClient(rows: Record<string, unknown>[] = []) {
  const channels: { name: string; handler: Handler; status: Status; removed: boolean }[] = [];
  const byHandle = new Map<object, (typeof channels)[number]>();
  const db = {
    channel(name: string) {
      const entry = { name, handler: (() => {}) as Handler, status: (() => {}) as Status, removed: false };
      const handle = {
        on: (_type: string, _filter: unknown, handler: Handler) => {
          entry.handler = handler;
          return handle;
        },
        subscribe: (status: Status) => {
          entry.status = status;
          return handle;
        },
      };
      channels.push(entry);
      byHandle.set(handle, entry);
      return handle;
    },
    removeChannel: async (handle: object) => {
      byHandle.get(handle)!.removed = true;
      return 'ok';
    },
    from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }),
  };
  return { db: db as unknown as SupabaseClient, channels };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the Supabase remote', () => {
  it('loads the client only once something needs it', async () => {
    const { db } = fakeClient([
      { day: 3, meal: 'dinner', pick: { kind: 'restaurant', id } },
      { day: 40, meal: 'dinner', pick: { kind: 'restaurant', id } },
    ]);
    const connect = vi.fn(async () => db);
    const remote = createSupabaseRemote(connect);
    expect(connect).not.toHaveBeenCalled();
    await expect(remote.fetchAll()).resolves.toEqual({ 3: { dinner: { kind: 'restaurant', id } } });
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('gives every subscription its own channel, so subscribing again right after leaving still gets changes', async () => {
    const { db, channels } = fakeClient();
    const remote = createSupabaseRemote(async () => db);
    const stop = remote.subscribe(
      () => {},
      () => {},
    );
    await vi.waitFor(() => expect(channels).toHaveLength(1));
    stop();
    const onChange = vi.fn();
    const onLive = vi.fn();
    remote.subscribe(onChange, onLive);
    await vi.waitFor(() => expect(channels).toHaveLength(2));
    expect(channels[0].removed).toBe(true);
    expect(channels[1].name).not.toBe(channels[0].name);

    channels[1].status('SUBSCRIBED');
    expect(onLive).toHaveBeenLastCalledWith(true);
    channels[1].handler({ eventType: 'DELETE', old: { plan_id: PLAN_ID, day: 3, meal: 'dinner' }, new: {} });
    expect(onChange).toHaveBeenCalledWith({ day: 3, meal: 'dinner', pick: null });
    channels[1].status('CHANNEL_ERROR');
    expect(onLive).toHaveBeenLastCalledWith(false);
  });

  it("doesn't open a channel when unsubscribed before the client has loaded", async () => {
    const { db, channels } = fakeClient();
    const remote = createSupabaseRemote(async () => db);
    remote.subscribe(
      () => {},
      () => {},
    )();
    await settle();
    expect(channels).toHaveLength(0);
  });

  it('tries again when the client fails to download', async () => {
    vi.useFakeTimers();
    try {
      const { db, channels } = fakeClient();
      const connect = vi.fn<() => Promise<SupabaseClient>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(db);
      createSupabaseRemote(connect).subscribe(
        () => {},
        () => {},
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(channels).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(5000);
      expect(channels).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
