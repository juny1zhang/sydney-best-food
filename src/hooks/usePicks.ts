import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { Picks } from '../lib/plan';
import { PENDING_KEY, STORAGE_KEY, loadPending, loadPicks, parsePending, parsePicks, savePending, savePicks } from '../lib/storage';
import { applyChange, diffPicks, samePick, sharedRemote, slotKey, type PicksRemote, type SlotChange } from '../lib/sync';

export const RETRY_MS = 5000;
/** While the live stream can't connect, how often to read the plan instead. */
export const POLL_MS = 6 * RETRY_MS;

/**
 * `local`: no shared backend. `offline`: the shared plan can't be read; retrying, and changes wait on this device.
 * `error`: a change hasn't reached the shared plan yet and will be retried.
 */
export type SyncState = 'local' | 'connecting' | 'live' | 'offline' | 'error';

/** Latest change per slot. */
function bySlot(changes: SlotChange[]): Map<string, SlotChange> {
  return new Map(changes.map((c) => [slotKey(c.day, c.meal), c]));
}

const sameChange = (a: SlotChange, b: SlotChange) => a.day === b.day && a.meal === b.meal && samePick(a.pick ?? undefined, b.pick ?? undefined);

/** Every open tab shares the stored list, so each one only touches the slots it changed. */
function storePending(changes: SlotChange[]): void {
  const stored = bySlot(loadPending());
  for (const c of changes) stored.set(slotKey(c.day, c.meal), c);
  savePending([...stored.values()]);
}

/** Drops a change the plan has confirmed, unless another tab has stored a newer one for that slot since. */
function clearPending(change: SlotChange): void {
  const stored = loadPending();
  const kept = stored.filter((c) => !sameChange(c, change));
  if (kept.length !== stored.length) savePending(kept);
}

/**
 * Picks state. With a shared remote, everyone who has the site open edits one plan and sees each
 * other's changes live; localStorage keeps a copy so the page paints instantly, plus any changes the
 * plan hasn't confirmed yet so a reload doesn't lose them. Without one, picks live in localStorage
 * only and stay in sync across open tabs.
 */
export function usePicks(remote: PicksRemote | null = sharedRemote) {
  /** Local changes the remote hasn't confirmed yet, latest value per slot. */
  const [unsynced] = useState(() => bySlot(remote ? loadPending() : []));
  const [picks, setPicksState] = useState<Picks>(() => {
    let p = loadPicks();
    for (const change of unsynced.values()) p = applyChange(p, change);
    return p;
  });
  /** The stream is connected and a read made since then has landed. */
  const [live, setLive] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const picksRef = useRef(picks);
  const queue = useRef<Promise<void>>(Promise.resolve());
  /** A flush round that hasn't started yet; it sends whatever is unsynced once it does. */
  const waiting = useRef<Promise<void> | null>(null);
  /** Remote changes that arrived while the latest read was in flight; null when no read is. */
  const replay = useRef<SlotChange[] | null>(null);
  /** Slots whose remote changes were skipped because a write of ours was pending. */
  const skipped = useRef(new Set<string>());
  const resync = useRef(() => {});

  const replace = useCallback((next: Picks) => {
    picksRef.current = next;
    setPicksState(next);
  }, []);

  useEffect(() => {
    savePicks(picks);
  }, [picks]);

  /**
   * Sends every unsynced change. Rounds run one after another, so writes to a slot land in the order they
   * were made; within a round each slot is written once, all together, so one failing slot holds up no other.
   */
  const flush = useCallback(() => {
    if (!remote) return Promise.resolve();
    if (waiting.current) return waiting.current;
    const round = queue.current.then(async () => {
      waiting.current = null;
      let stale = false;
      const sent = await Promise.all(
        [...unsynced].map(async ([key, change]) => {
          try {
            await remote.write(change);
          } catch {
            return false;
          }
          // A read still in flight may have missed this write: put it back on top of whatever that read returns.
          if (replay.current) {
            stale = true;
            replay.current.push(change);
          }
          if (unsynced.get(key) === change) {
            unsynced.delete(key);
            clearPending(change);
            // A change from someone else was skipped meanwhile and may be newer than ours.
            if (skipped.current.delete(key)) stale = true;
          }
          return true;
        }),
      );
      setWriteFailed(sent.includes(false));
      if (stale) resync.current();
    });
    waiting.current = round;
    queue.current = round;
    return round;
  }, [remote, unsynced]);

  useEffect(() => {
    if (!writeFailed) return;
    const t = window.setInterval(() => void flush(), RETRY_MS);
    return () => window.clearInterval(t);
  }, [writeFailed, flush]);

  const setPicks = useCallback(
    (action: SetStateAction<Picks>) => {
      const prev = picksRef.current;
      const next = typeof action === 'function' ? action(prev) : action;
      if (next === prev) return;
      replace(next);
      if (!remote) return;
      const changes = diffPicks(prev, next);
      for (const change of changes) unsynced.set(slotKey(change.day, change.meal), change);
      storePending(changes);
      void flush();
    },
    [remote, unsynced, flush, replace],
  );

  useEffect(() => {
    if (!remote) return;
    let active = true;
    let latest = 0;
    let retry = 0;
    let poll = 0;
    let streamUp = false;

    /** Retries pending writes and reloads the whole plan, keeping any change still in flight. Only the latest read lands. */
    const reload = async () => {
      const mine = ++latest;
      window.clearTimeout(retry);
      window.clearTimeout(poll);
      void flush();
      const seen: SlotChange[] = [];
      replay.current = seen;
      let next: Picks;
      try {
        next = await remote.fetchAll();
      } catch {
        if (!active || mine !== latest) return;
        replay.current = null;
        setReadFailed(true);
        retry = window.setTimeout(() => void reload(), RETRY_MS);
        return;
      }
      if (!active || mine !== latest) return;
      replay.current = null;
      // Changes streamed in while the read was in flight may be newer than what it returned.
      for (const change of seen) next = applyChange(next, change);
      for (const change of unsynced.values()) next = applyChange(next, change);
      replace(next);
      setReadFailed(false);
      if (streamUp) setLive(true);
      // Some networks block the live stream but not reads: keep reading now and then so other people's changes still arrive.
      else poll = window.setTimeout(() => void reload(), POLL_MS);
    };
    resync.current = () => void reload();

    const stop = remote.subscribe(
      (change) => {
        if (!active) return;
        replay.current?.push(change);
        const key = slotKey(change.day, change.meal);
        const current = picksRef.current;
        const next = applyChange(current, change);
        if (next === current) return;
        // Our own pending value wins until the server has it; then the plan is read again.
        if (unsynced.has(key)) skipped.current.add(key);
        else replace(next);
      },
      (isLive) => {
        if (!active) return;
        streamUp = isLive;
        // Catch up on anything missed while the stream was down; it only counts as live once that has landed.
        if (isLive) void reload();
        else {
          setLive(false);
          window.clearTimeout(poll);
          poll = window.setTimeout(() => void reload(), POLL_MS);
        }
      },
    );
    void reload();

    // Phones drop the stream in the background; reload when the page comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);

    // Another tab sent or replaced a change this one is also holding (say, one it loaded from storage at start):
    // let that tab's version stand rather than send ours over it later.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PENDING_KEY) return;
      const stored = parsePending(e.newValue);
      let dropped = false;
      for (const [key, change] of unsynced) {
        if (stored.some((c) => sameChange(c, change))) continue;
        unsynced.delete(key);
        skipped.current.delete(key);
        dropped = true;
      }
      if (dropped) void reload();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      window.clearTimeout(retry);
      window.clearTimeout(poll);
      stop();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
      resync.current = () => {};
      replay.current = null;
      setLive(false);
    };
  }, [remote, unsynced, flush, replace]);

  useEffect(() => {
    if (remote) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) replace(parsePicks(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [remote, replace]);

  const sync: SyncState = !remote ? 'local' : readFailed ? 'offline' : writeFailed ? 'error' : live ? 'live' : 'connecting';
  return [picks, setPicks, sync] as const;
}
