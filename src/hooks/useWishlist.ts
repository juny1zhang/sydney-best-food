import { useCallback, useEffect, useState } from 'react';
import { WISHLIST_KEY, loadWishlist, parseWishlist, saveWishlist } from '../lib/storage';

/** Places the user wants to try, kept in localStorage and synced across tabs. */
export function useWishlist() {
  const [ids, setIds] = useState<string[]>(loadWishlist);

  useEffect(() => {
    saveWishlist(ids);
  }, [ids]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === WISHLIST_KEY) setIds(parseWishlist(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }, []);

  return { ids, setIds, toggle, has: (id: string) => ids.includes(id) };
}
