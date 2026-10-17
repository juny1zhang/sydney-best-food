import { NZ_VENUES, townOf } from './nz';
import { RESTAURANTS, categoryOf } from './restaurants';
import type { NzVenue, Place, Restaurant } from './types';

export function sydneyPlace(r: Restaurant): Place {
  const category = categoryOf(r.category);
  return {
    id: r.id,
    region: 'syd',
    name: r.name,
    nameZh: r.nameZh,
    area: r.suburb,
    price: r.price,
    categoryLabel: category.name,
    categoryShort: category.short,
    rankLabel: `${category.short}第 ${r.rank} 名`,
    badges: r.badges,
    tags: r.tags,
    intro: r.intro,
    booking: r.booking,
    meals: r.meals,
    website: r.website,
    address: `${r.suburb}, Sydney NSW`,
    mapsQuery: `${r.name} ${r.suburb} Sydney`,
    accolades: r.accolades,
    sources: r.sources,
  };
}

export function nzPlace(v: NzVenue): Place {
  const town = townOf(v.town);
  return {
    id: v.id,
    region: 'nz',
    name: v.name,
    nameZh: v.nameZh,
    area: town.name,
    price: v.price,
    categoryLabel: v.categoryLabel,
    categoryShort: v.categoryShort ?? v.categoryLabel,
    rankLabel: town.name,
    badges: v.badges,
    tags: v.tags,
    intro: v.intro,
    booking: v.booking,
    meals: v.meals,
    website: v.website,
    address: v.address || `${town.en}, New Zealand`,
    mapsQuery: v.address ? `${v.name} ${v.address}` : `${v.name} ${town.en} New Zealand`,
    accolades: [],
    sources: v.sources,
  };
}

/** Every pickable place, Sydney and New Zealand, by id. */
export const PLACE_BY_ID: ReadonlyMap<string, Place> = new Map<string, Place>([
  ...RESTAURANTS.map((r): [string, Place] => [r.id, sydneyPlace(r)]),
  ...NZ_VENUES.map((v): [string, Place] => [v.id, nzPlace(v)]),
]);

export function placeById(id: string): Place | undefined {
  return PLACE_BY_ID.get(id);
}
