import { act, renderHook, waitFor } from '@testing-library/react';
import { RESTAURANTS } from '../data/restaurants';
import { removePick, setPick, type Picks } from '../lib/plan';
import { applyChange, type PicksRemote, type SlotChange } from '../lib/sync';
import { usePicks } from './usePicks';

const id = RESTAURANTS[0].id;
const other = RESTAURANTS[1].id;

/** An in-memory stand-in for the shared plan. */
function fakeRemote(initial: Picks = {}) {
  let server = initial;
  let failing = false;
  let onChange: (c: SlotChange) => void = () => {};
  let onLive: (live: boolean) => void = () => {};
  const remote: PicksRemote = {
    fetchAll: vi.fn(async () => server),
    write: vi.fn(async (c: SlotChange) => {
      if (failing) throw new Error('offline');
      server = applyChange(server, c);
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
    live: (on: boolean) => act(() => onLive(on)),
    /** Someone else changed the plan. */
    push: (c: SlotChange) => {
      server = applyChange(server, c);
      act(() => onChange(c));
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
});
