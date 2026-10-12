import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { Picks } from '../lib/plan';
import { STORAGE_KEY, loadPicks, parsePicks, savePicks } from '../lib/storage';
import { applyChange, diffPicks, sharedRemote, slotKey, type PicksRemote, type SlotChange } from '../lib/sync';

const RETRY_MS = 5000;

/** `local`: no shared backend. `error`: a change hasn't reached the shared plan yet and will be retried. */
export type SyncState = 'local' | 'connecting' | 'live' | 'error';

/**
 * Picks state. With a shared remote, everyone who has the site open edits one plan and sees each
 * other's changes live; localStorage keeps a copy so the page paints instantly. Without one, picks
 * live in localStorage only and stay in sync across open tabs.
 */
export function usePicks(remote: PicksRemote | null = sharedRemote) {
  const [picks, setPicksState] = useState<Picks>(loadPicks);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const picksRef = useRef(picks);
  /** Local changes the remote hasn't confirmed yet, latest value per slot. */
  const unsynced = useRef(new Map<string, SlotChange>());
  const queue = useRef<Promise<void>>(Promise.resolve());

  const replace = useCallback((next: Picks) => {
    picksRef.current = next;
    setPicksState(next);
  }, []);

  useEffect(() => {
    savePicks(picks);
  }, [picks]);

  /** Sends unsynced changes one at a time, so writes to a slot land in the order they were made. */
  const flush = useCallback(() => {
    queue.current = queue.current.then(async () => {
      if (!remote) return;
      for (const [key, change] of unsynced.current) {
        try {
          await remote.write(change);
        } catch {
          setWriteFailed(true);
          return;
        }
        if (unsynced.current.get(key) === change) unsynced.current.delete(key);
      }
      if (!unsynced.current.size) setWriteFailed(false);
    });
    return queue.current;
  }, [remote]);

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
      for (const change of diffPicks(prev, next)) unsynced.current.set(slotKey(change.day, change.meal), change);
      void flush();
    },
    [remote, flush, replace],
  );

  useEffect(() => {
    if (!remote) return;
    let active = true;

    /** Retries pending writes, then reloads the whole plan, keeping any change still in flight. */
    const resync = async () => {
      await flush();
      let next: Picks;
      try {
        next = await remote.fetchAll();
      } catch {
        return;
      }
      if (!active) return;
      for (const change of unsynced.current.values()) next = applyChange(next, change);
      replace(next);
      setLoaded(true);
    };

    const stop = remote.subscribe(
      (change) => {
        // Our own pending value wins until the server has it.
        if (!active || unsynced.current.has(slotKey(change.day, change.meal))) return;
        replace(applyChange(picksRef.current, change));
      },
      (isLive) => {
        if (!active) return;
        setLive(isLive);
        // Catch up on anything missed while the stream was down.
        if (isLive) void resync();
      },
    );
    void resync();

    // Phones drop the stream in the background; reload when the page comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void resync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [remote, flush, replace]);

  useEffect(() => {
    if (remote) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) replace(parsePicks(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [remote, replace]);

  const sync: SyncState = !remote ? 'local' : writeFailed ? 'error' : loaded && live ? 'live' : 'connecting';
  return [picks, setPicks, sync] as const;
}
