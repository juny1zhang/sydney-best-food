import { RESTAURANT_BY_ID } from '../data/restaurants';

const PREFIX = '#r/';

/** Link to a restaurant's own page. */
export function detailHref(id: string): string {
  return `${PREFIX}${encodeURIComponent(id)}`;
}

/** The restaurant a URL hash points at, or null for the main page (or an id that doesn't exist). */
export function restaurantFromHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(PREFIX.length));
  } catch {
    return null;
  }
  return RESTAURANT_BY_ID.has(id) ? id : null;
}
