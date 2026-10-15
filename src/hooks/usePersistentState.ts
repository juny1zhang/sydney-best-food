import { useEffect, useState } from 'react';

function load<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const stored = window.localStorage.getItem(key);
    return (allowed as readonly (string | null)[]).includes(stored) ? (stored as T) : null;
  } catch {
    return null;
  }
}

/**
 * useState for a choice from a fixed set, remembered across reloads in localStorage.
 * A stored value that isn't one of `allowed` (renamed since, edited by hand) gives `initial` instead.
 */
export function usePersistentState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => load(key, allowed) ?? initial);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode or blocked storage: the choice just won't survive a reload.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
