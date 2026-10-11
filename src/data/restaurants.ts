import raw from './restaurants.json';
import type { Category, CategoryId, Restaurant } from './types';

interface RestaurantFile {
  verifiedOn: string;
  categories: Category[];
  restaurants: Restaurant[];
}

const file = raw as RestaurantFile;

export const VERIFIED_ON = file.verifiedOn;
export const CATEGORIES: Category[] = file.categories;
export const RESTAURANTS: Restaurant[] = file.restaurants;

export const RESTAURANT_BY_ID: ReadonlyMap<string, Restaurant> = new Map(RESTAURANTS.map((r) => [r.id, r]));

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id: CategoryId): Category {
  const c = CATEGORY_BY_ID.get(id);
  if (!c) throw new Error(`Unknown category ${id}`);
  return c;
}

/** Restaurants of one category, best first. */
export function restaurantsIn(id: CategoryId): Restaurant[] {
  return RESTAURANTS.filter((r) => r.category === id).sort((a, b) => a.rank - b.rank);
}

export function mapsUrl(name: string, place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${place}`)}`;
}

/** Case-insensitive search over name, Chinese name, suburb, category and tags. */
export function searchRestaurants(query: string): Restaurant[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return RESTAURANTS.filter((r) => {
    const hay = [r.name, r.nameZh, r.suburb, categoryOf(r.category).name, ...r.tags].join(' ').toLowerCase();
    return hay.includes(q);
  });
}
