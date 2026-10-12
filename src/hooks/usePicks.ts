import { useEffect, useState } from 'react';
import type { Picks } from '../lib/plan';
import { STORAGE_KEY, loadPicks, parsePicks, savePicks } from '../lib/storage';

/** Picks state that survives reloads via localStorage and stays in sync across open tabs. */
export function usePicks() {
  const [picks, setPicks] = useState<Picks>(loadPicks);

  useEffect(() => {
    savePicks(picks);
  }, [picks]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPicks(parsePicks(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return [picks, setPicks] as const;
}
