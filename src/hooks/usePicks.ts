import { useEffect, useState } from 'react';
import type { Picks } from '../lib/plan';
import { loadPicks, savePicks } from '../lib/storage';

/** Picks state that survives reloads via localStorage. */
export function usePicks() {
  const [picks, setPicks] = useState<Picks>(loadPicks);
  useEffect(() => {
    savePicks(picks);
  }, [picks]);
  return [picks, setPicks] as const;
}
