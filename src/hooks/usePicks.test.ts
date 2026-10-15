import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { RESTAURANTS } from '../data/restaurants';
import type { Meal } from '../data/types';
import { removePick, setPick, type Picks } from '../lib/plan';
import { PENDING_KEY, loadPending } from '../lib/storage';
import { applyChange, slotKey, type PicksRemote, type SlotChange } from '../lib/sync';
import { POLL_MS, RETRY_MS, usePicks } from './usePicks';

const id = RESTAURANTS[0].id;
const other = RESTAURANTS[1].id;

/** Lets calls through, or holds them until opened. */
function gate() {
  let held: (() => void)[] | null = null;
  return {
    close: () => {
      held ??= [];
    },
    /** `newestFirst` answers the held calls in reverse, like a slow request overtaken by a later one. */
    open: (newestFirst = false) =>
      act(async () => {
        const go = held ?? [];
        held = null;
        (newestFirst ? [...go].reverse() : go).forEach((f) => f());
      }),
    pass: () => (held ? new Promise<void>((resolve) => held!.push(resolve)) : Promise.resolve()),
  };
}

/** An in-memory stand-in for the shared plan. */
function fakeRemote(initial: Picks = {}) {
  let server = initial;
  let failing = false;
  let readFailing = false;
  const failingSlots = new Set<string>();
  /** Slots whose writes hang until released. */
  const hanging = new Map<string, (() => void) | null>();
  const reads = gate();
  const writes = gate();
  let onChange: (c: SlotChange) => void = () => {};
  let onLive: (live: boolean) => void = () => {};
  const remote: PicksRemote = {
    fetchAll: vi.fn(async () => {
      if (readFailing) throw new Error('offline');
      // The plan as it is when asked; the answer may arrive later.
      const snapshot = server;
      await reads.pass();
      return snapshot;
    }),
    write: vi.fn(async (c: SlotChange) => {
      if (failing || failingSlots.has(slotKey(c.day, c.meal))) throw new Error('offline');
      if (hanging.has(slotKey(c.day, c.meal))) await new Promise<void>((resolve) => hanging.set(slotKey(c.day, c.meal), resolve));
      server = applyChange(server, c);
      // The server has it; the answer may arrive later.
      await writes.pass();
    }),
    subscribe: (change, live) => {
      onChange = change;
      onLive = live;
      return () => {};
    },
  };
  return {
    remote,
    get server() {
      return server;
    },
    fail: (on: boolean) => (failing = on),
    failReads: (on: boolean) => (readFailing = on),
    failSlot: (day: number, meal: Meal, on = true) => (on ? failingSlots.add(slotKey(day, meal)) : failingSlots.delete(slotKey(day, meal))),
    hangSlot: (day: number, meal: Meal) => hanging.set(slotKey(day, meal), null),
    releaseSlot: (day: number, meal: Meal) =>
      act(async () => {
        const release = hanging.get(slotKey(day, meal));
        hanging.delete(slotKey(day, meal));
        release?.();
      }),
    holdReads: reads.close,
    answerReads: reads.open,
    holdWrites: writes.close,
    answerWrites: writes.open,
    live: (on: boolean) => act(() => onLive(on)),
    /** Someone else changed the plan. */
    push: (c: SlotChange) => {
      server = applyChange(server, c);
      act(() => onChange(c));
    },
    /** Someone else changed the plan while our stream was down, so no event arrives. */
    change: (c: SlotChange) => {
      server = applyChange(server, c);
    },
  };
}

describe('usePicks with a shared plan', () => {
  it('loads the plan and reports live once the stream connects', async () => {
    const fake = fakeRemote({ 6: { lunch: { kind: 'restaurant', id } } });
    const { result } = renderHook(() => usePicks(fake.remote));
    expect(result.current[2]).toBe('connecting');
    fake.live(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));
    expect(result.current[0]).toEqual({ 6: { lunch: { kind: 'restaurant', id } } });
  });

  it('writes only the slot that changed', async () => {
    const fake = fakeRemote({ 6: { lunch: { kind: 'restaurant', id } } });
    const { result } = renderHook(() => usePicks(fake.remote));
    await waitFor(() => expect(fake.remote.fetchAll).toHaveBeenCalled());
    await waitFor(() => expect(result.current[0][6]).toBeDefined());
    act(() => result.current[1]((p) => setPick(p, 9, 'dinner', { kind: 'restaurant', id: other })));
    await waitFor(() => expect(fake.server[9]).toEqual({ dinner: { kind: 'restaurant', id: other } }));
    expect(fake.remote.write).toHaveBeenCalledTimes(1);
    act(() => result.current[1]((p) => removePick(p, 6, 'lunch')));
    await waitFor(() => expect(fake.server[6]).toBeUndefined());
  });

  it("shows other people's changes as they happen", async () => {
    const fake = fakeRemote();
    const { result } = renderHook(() => usePicks(fake.remote));
    await waitFor(() => expect(fake.remote.fetchAll).toHaveBeenCalled());
    fake.push({ day: 12, meal: 'lunch', pick: { kind: 'custom', name: '海边炸鱼', note: '' } });
    expect(result.current[0][12]).toEqual({ lunch: { kind: 'custom', name: '海边炸鱼', note: '' } });
    fake.push({ day: 12, meal: 'lunch', pick: null });
    expect(result.current[0][12]).toBeUndefined();
  });

  it('keeps a failed change, says so, and sends it when the connection comes back', async () => {
    const fake = fakeRemote();
    const { result } = renderHook(() => usePicks(fake.remote));
    fake.live(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));

    fake.fail(true);
    act(() => result.current[1]((p) => setPick(p, 20, 'dinner', { kind: 'restaurant', id })));
    await waitFor(() => expect(result.current[2]).toBe('error'));
    expect(result.current[0][20]).toBeDefined();

    // A stale echo for that slot must not undo the pending change.
    fake.push({ day: 20, meal: 'dinner', pick: null });
    expect(result.current[0][20]).toEqual({ dinner: { kind: 'restaurant', id } });

    fake.fail(false);
    fake.live(false);
    fake.live(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));
    expect(fake.server[20]).toEqual({ dinner: { kind: 'restaurant', id } });
    expect(result.current[0][20]).toEqual({ dinner: { kind: 'restaurant', id } });
  });

  it('keeps an unsent change through a reload and sends it then', async () => {
    const fake = fakeRemote();
    fake.fail(true);
    const before = renderHook(() => usePicks(fake.remote));
    act(() => before.result.current[1]((p) => setPick(p, 8, 'dinner', { kind: 'restaurant', id, booked: true, time: '19:30' })));
    await waitFor(() => expect(before.result.current[2]).toBe('error'));
    before.unmount();
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();

    fake.fail(false);
    const after = renderHook(() => usePicks(fake.remote));
    const pick = { kind: 'restaurant', id, booked: true, time: '19:30' };
    expect(after.result.current[0][8]).toEqual({ dinner: pick });
    await waitFor(() => expect(fake.server[8]).toEqual({ dinner: pick }));
    await waitFor(() => expect(localStorage.getItem(PENDING_KEY)).toBeNull());
    // The plan as read before the write landed doesn't wipe it out.
    expect(after.result.current[0][8]).toEqual({ dinner: pick });
  });

  it("keeps sending other changes when one slot can't be saved", async () => {
    const fake = fakeRemote();
    const { result } = renderHook(() => usePicks(fake.remote));
    await waitFor(() => expect(fake.remote.fetchAll).toHaveBeenCalled());
    fake.failSlot(9, 'dinner');
    act(() =>
      result.current[1]((p) => setPick(setPick(p, 9, 'dinner', { kind: 'restaurant', id }), 10, 'lunch', { kind: 'restaurant', id: other })),
    );
    await waitFor(() => expect(result.current[2]).toBe('error'));
    expect(fake.server[10]).toEqual({ lunch: { kind: 'restaurant', id: other } });
    expect(fake.server[9]).toBeUndefined();

    // The next round tries the failed slot again along with anything new.
    fake.failSlot(9, 'dinner', false);
    act(() => result.current[1]((p) => setPick(p, 11, 'lunch', { kind: 'restaurant', id })));
    await waitFor(() => expect(fake.server[9]).toEqual({ dinner: { kind: 'restaurant', id } }));
    await waitFor(() => expect(result.current[2]).toBe('connecting'));
    expect(fake.server[11]).toEqual({ lunch: { kind: 'restaurant', id } });
  });

  it("says when the plan can't be reached, and keeps trying until it can", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fake = fakeRemote({ 6: { lunch: { kind: 'restaurant', id } } });
      fake.failReads(true);
      const { result } = renderHook(() => usePicks(fake.remote));
      fake.live(true);
      await waitFor(() => expect(result.current[2]).toBe('offline'));
      const tries = vi.mocked(fake.remote.fetchAll).mock.calls.length;

      await act(() => vi.advanceTimersByTimeAsync(RETRY_MS));
      expect(fake.remote.fetchAll).toHaveBeenCalledTimes(tries + 1);
      expect(result.current[2]).toBe('offline');

      fake.failReads(false);
      await act(() => vi.advanceTimersByTimeAsync(RETRY_MS));
      await waitFor(() => expect(result.current[2]).toBe('live'));
      expect(result.current[0]).toEqual({ 6: { lunch: { kind: 'restaurant', id } } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a change that streams in while the plan is being read', async () => {
    const fake = fakeRemote({ 6: { lunch: { kind: 'restaurant', id } } });
    fake.holdReads();
    const { result } = renderHook(() => usePicks(fake.remote));
    await waitFor(() => expect(fake.remote.fetchAll).toHaveBeenCalled());
    fake.push({ day: 15, meal: 'lunch', pick: { kind: 'custom', name: '码头生蚝', note: '' } });
    expect(result.current[0][15]).toBeDefined();

    // The read was taken before that change; it lands now.
    await fake.answerReads();
    await waitFor(() => expect(result.current[0][6]).toBeDefined());
    expect(result.current[0][15]).toEqual({ lunch: { kind: 'custom', name: '码头生蚝', note: '' } });
  });

  it('only lets the latest read land', async () => {
    const fake = fakeRemote({ 4: { dinner: { kind: 'restaurant', id } } });
    fake.holdReads();
    const { result } = renderHook(() => usePicks(fake.remote));
    await waitFor(() => expect(fake.remote.fetchAll).toHaveBeenCalledTimes(1));
    fake.change({ day: 4, meal: 'dinner', pick: { kind: 'restaurant', id: other } });
    fake.live(true);
    expect(fake.remote.fetchAll).toHaveBeenCalledTimes(2);

    // The older read answers last and must not put the old pick back.
    await fake.answerReads(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));
    expect(result.current[0]).toEqual({ 4: { dinner: { kind: 'restaurant', id: other } } });
  });

  it('reads the plan again once a write lands, if a change from someone else was held back meanwhile', async () => {
    const fake = fakeRemote();
    const { result } = renderHook(() => usePicks(fake.remote));
    fake.live(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));

    fake.holdWrites();
    act(() => result.current[1]((p) => setPick(p, 18, 'dinner', { kind: 'restaurant', id })));
    await waitFor(() => expect(fake.remote.write).toHaveBeenCalled());
    const reads = vi.mocked(fake.remote.fetchAll).mock.calls.length;

    // Someone else picks after our write reached the server but before we heard back.
    fake.push({ day: 18, meal: 'dinner', pick: { kind: 'restaurant', id: other } });
    expect(result.current[0][18]).toEqual({ dinner: { kind: 'restaurant', id } });

    await fake.answerWrites();
    await waitFor(() => expect(result.current[0][18]).toEqual({ dinner: { kind: 'restaurant', id: other } }));
    expect(fake.remote.fetchAll).toHaveBeenCalledTimes(reads + 1);
  });

  it("doesn't read again when the only change held back was the echo of our own write", async () => {
    const fake = fakeRemote();
    const { result } = renderHook(() => usePicks(fake.remote));
    fake.live(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));

    fake.holdWrites();
    act(() => result.current[1]((p) => setPick(p, 18, 'dinner', { kind: 'restaurant', id })));
    await waitFor(() => expect(fake.remote.write).toHaveBeenCalled());
    const reads = vi.mocked(fake.remote.fetchAll).mock.calls.length;
    fake.push({ day: 18, meal: 'dinner', pick: { kind: 'restaurant', id } });
    await fake.answerWrites();
    await waitFor(() => expect(localStorage.getItem(PENDING_KEY)).toBeNull());
    expect(fake.remote.fetchAll).toHaveBeenCalledTimes(reads);
  });

  it('is not live after a reconnect until it has caught up', async () => {
    const fake = fakeRemote();
    const { result } = renderHook(() => usePicks(fake.remote));
    fake.live(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));

    fake.live(false);
    expect(result.current[2]).toBe('connecting');
    fake.change({ day: 24, meal: 'dinner', pick: { kind: 'custom', name: '平安夜烤火鸡', note: '' } });
    fake.holdReads();
    fake.live(true);
    await act(async () => {});
    expect(result.current[2]).toBe('connecting');

    await fake.answerReads();
    await waitFor(() => expect(result.current[2]).toBe('live'));
    expect(result.current[0][24]).toEqual({ dinner: { kind: 'custom', name: '平安夜烤火鸡', note: '' } });
  });

  it('still shows live changes under StrictMode', async () => {
    const fake = fakeRemote();
    const { result } = renderHook(() => usePicks(fake.remote), { wrapper: StrictMode });
    fake.live(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));
    fake.push({ day: 5, meal: 'lunch', pick: { kind: 'restaurant', id } });
    expect(result.current[0][5]).toEqual({ lunch: { kind: 'restaurant', id } });
  });
});

/** What another tab writing the pending list looks like to this one. */
function storageEventFromOtherTab() {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: PENDING_KEY, newValue: localStorage.getItem(PENDING_KEY) }));
  });
}

describe('usePicks across tabs', () => {
  afterEach(() => localStorage.clear());

  it("keeps each tab's unsent change when both are offline", async () => {
    const fake = fakeRemote();
    fake.fail(true);
    const tabA = renderHook(() => usePicks(fake.remote));
    const tabB = renderHook(() => usePicks(fake.remote));
    act(() => tabA.result.current[1]((p) => setPick(p, 8, 'dinner', { kind: 'restaurant', id })));
    act(() => tabB.result.current[1]((p) => setPick(p, 9, 'lunch', { kind: 'restaurant', id: other })));
    await waitFor(() => expect(tabB.result.current[2]).toBe('error'));
    expect(loadPending()).toHaveLength(2);
    tabA.unmount();
    tabB.unmount();

    fake.fail(false);
    renderHook(() => usePicks(fake.remote));
    await waitFor(() => expect(localStorage.getItem(PENDING_KEY)).toBeNull());
    expect(fake.server).toEqual({ 8: { dinner: { kind: 'restaurant', id } }, 9: { lunch: { kind: 'restaurant', id: other } } });
  });

  it("doesn't drop another tab's unsent change when its own write lands", async () => {
    const fake = fakeRemote();
    const tabA = renderHook(() => usePicks(fake.remote));
    const tabB = renderHook(() => usePicks(fake.remote));
    fake.failSlot(8, 'dinner');
    act(() => tabA.result.current[1]((p) => setPick(p, 8, 'dinner', { kind: 'restaurant', id })));
    await waitFor(() => expect(tabA.result.current[2]).toBe('error'));
    act(() => tabB.result.current[1]((p) => setPick(p, 9, 'lunch', { kind: 'restaurant', id: other })));
    await waitFor(() => expect(fake.server[9]).toBeDefined());
    expect(loadPending()).toEqual([{ day: 8, meal: 'dinner', pick: { kind: 'restaurant', id } }]);
  });

  it('lets go of a change another tab has already sent, so it never comes back after being cleared', async () => {
    // One plan, and a connection per tab that can be down on its own.
    let server: Picks = {};
    const tab = () => {
      let down = true;
      const remote: PicksRemote = {
        fetchAll: async () => {
          if (down) throw new Error('offline');
          return server;
        },
        write: async (c) => {
          if (down) throw new Error('offline');
          server = applyChange(server, c);
        },
        subscribe: () => () => {},
      };
      return { remote, up: () => (down = false) };
    };
    const comeBack = () => act(async () => void document.dispatchEvent(new Event('visibilitychange')));

    const a = tab();
    const tabA = renderHook(() => usePicks(a.remote));
    act(() => tabA.result.current[1]((p) => setPick(p, 8, 'dinner', { kind: 'restaurant', id })));
    await waitFor(() => expect(tabA.result.current[2]).toBe('offline'));
    // A second tab opens while still offline and picks up the same unsent change.
    const b = tab();
    const tabB = renderHook(() => usePicks(b.remote));
    expect(tabB.result.current[0][8]).toEqual({ dinner: { kind: 'restaurant', id } });

    // The first tab gets through, then the dinner is cleared there.
    a.up();
    await comeBack();
    await waitFor(() => expect(server[8]).toBeDefined());
    storageEventFromOtherTab();
    act(() => tabA.result.current[1]((p) => removePick(p, 8, 'dinner')));
    await waitFor(() => expect(server[8]).toBeUndefined());
    storageEventFromOtherTab();

    // When the second tab gets through, it must not send the old dinner again.
    b.up();
    await comeBack();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(server[8]).toBeUndefined();
    expect(tabB.result.current[0][8]).toBeUndefined();
  });
});

describe('usePicks while a read is in flight', () => {
  it('keeps a confirmed change on screen when an older read lands while another write is still out', async () => {
    const fake = fakeRemote();
    const { result } = renderHook(() => usePicks(fake.remote));
    fake.live(true);
    await waitFor(() => expect(result.current[2]).toBe('live'));

    fake.fail(true);
    act(() => result.current[1]((p) => setPick(setPick(p, 8, 'dinner', { kind: 'restaurant', id }), 9, 'lunch', { kind: 'restaurant', id: other })));
    await waitFor(() => expect(result.current[2]).toBe('error'));

    // Back online: the slot-9 write hangs while slot 8 gets through, and a read taken before slot 8 landed answers.
    fake.fail(false);
    fake.holdReads();
    fake.hangSlot(9, 'lunch');
    fake.live(false);
    fake.live(true);
    await waitFor(() => expect(fake.server[8]).toBeDefined());
    await fake.answerReads();
    expect(result.current[0][8]).toEqual({ dinner: { kind: 'restaurant', id } });
    await fake.releaseSlot(9, 'lunch');
    await waitFor(() => expect(fake.server[9]).toBeDefined());
  });
});

describe('usePicks when the live stream is blocked', () => {
  it('reads the plan now and then so other people\'s changes still arrive', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeRemote();
      const { result } = renderHook(() => usePicks(fake.remote));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(fake.remote.fetchAll).toHaveBeenCalledTimes(1);
      fake.change({ day: 5, meal: 'dinner', pick: { kind: 'restaurant', id } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS);
      });
      expect(fake.remote.fetchAll).toHaveBeenCalledTimes(2);
      expect(result.current[0][5]).toEqual({ dinner: { kind: 'restaurant', id } });
      expect(result.current[2]).toBe('connecting');
    } finally {
      vi.useRealTimers();
    }
  });
});

