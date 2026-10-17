import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { restaurantFromHash } from '../lib/route';

interface MainSpot {
  /** The main page's hash when the restaurant page opened. */
  hash: string;
  scrollY: number;
  focus: Element | null;
}

/**
 * Which restaurant page is open (`#r/<id>`), or null for the main page. The main page stays
 * mounted underneath, so on the way back its scroll position and focus are put back as they were;
 * leaving through a section link (#list, #calendar) goes to that section instead.
 */
export function useRestaurantRoute() {
  const [id, setId] = useState(() => restaurantFromHash(window.location.hash));
  const idRef = useRef(id);
  const spot = useRef<MainSpot | null>(null);

  useEffect(() => {
    const onHash = (e: HashChangeEvent) => {
      const next = restaurantFromHash(window.location.hash);
      if (next && !idRef.current) {
        spot.current = { hash: new URL(e.oldURL).hash, scrollY: window.scrollY, focus: document.activeElement };
      }
      idRef.current = next;
      setId(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useLayoutEffect(() => {
    if (id) {
      window.scrollTo(0, 0);
      return;
    }
    const back = spot.current;
    spot.current = null;
    const hash = window.location.hash;
    if (back && back.hash === hash) {
      window.scrollTo(0, back.scrollY);
      if (back.focus instanceof HTMLElement && back.focus.isConnected) back.focus.focus({ preventScroll: true });
    } else if (hash.length > 1) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.();
    }
  }, [id]);

  /** Back to wherever the page was opened from; a shared link opened directly lands on the list. */
  const close = useCallback(() => {
    if (spot.current) window.history.back();
    else window.location.hash = 'list';
  }, []);

  /** Leaves for a section of the main page (#list, #calendar) rather than where the page was opened from. */
  const goTo = useCallback((section: string) => {
    spot.current = null;
    window.location.hash = section;
  }, []);

  return { id, close, goTo };
}
