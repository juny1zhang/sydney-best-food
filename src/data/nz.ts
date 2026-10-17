import raw from './nz.json';
import type { Meal, NzVenue, Town, TownId } from './types';

interface NzFile {
  verifiedOn: string;
  venues: NzVenue[];
}

const file = raw as NzFile;

export const NZ_VERIFIED_ON = file.verifiedOn;
export const NZ_VENUES: NzVenue[] = file.venues;

/** Route order, north to south and back up the east coast. */
export const TOWNS: Town[] = [
  { id: 'auckland', name: '奥克兰', en: 'Auckland' },
  { id: 'waitomo', name: '怀托摩', en: 'Waitomo' },
  { id: 'rotorua', name: '罗托鲁瓦', en: 'Rotorua' },
  { id: 'matamata', name: '玛塔玛塔', en: 'Matamata' },
  { id: 'christchurch', name: '基督城', en: 'Christchurch' },
  { id: 'geraldine', name: '杰拉尔丁', en: 'Geraldine' },
  { id: 'fairlie', name: '费尔利', en: 'Fairlie' },
  { id: 'tekapo', name: '特卡波', en: 'Tekapo' },
  { id: 'mount-cook', name: '库克山村', en: 'Mount Cook' },
  { id: 'twizel', name: '特威泽尔', en: 'Twizel' },
  { id: 'wanaka', name: '瓦纳卡', en: 'Wānaka' },
  { id: 'queenstown', name: '皇后镇', en: 'Queenstown' },
  { id: 'arrowtown', name: '箭镇', en: 'Arrowtown' },
  { id: 'te-anau', name: '蒂阿瑙', en: 'Te Anau' },
  { id: 'cromwell', name: '克伦威尔', en: 'Cromwell' },
  { id: 'omarama', name: '奥马拉马', en: 'Omarama' },
  { id: 'oamaru', name: '奥马鲁', en: 'Oamaru' },
  { id: 'moeraki', name: '莫拉基', en: 'Moeraki' },
];

const TOWN_BY_ID = new Map(TOWNS.map((t) => [t.id, t]));

export function townOf(id: TownId): Town {
  const t = TOWN_BY_ID.get(id);
  if (!t) throw new Error(`Unknown town ${id}`);
  return t;
}

/**
 * Where each meal of each New Zealand day is likely eaten, best bet first:
 * lunch on the road, dinner where we sleep (or at the airport on flight days).
 */
export const DAY_TOWNS: Record<number, Record<Meal, TownId[]>> = {
  6: { lunch: ['auckland'], dinner: ['auckland'] },
  7: { lunch: ['waitomo'], dinner: ['rotorua'] },
  8: { lunch: ['rotorua'], dinner: ['rotorua'] },
  9: { lunch: ['matamata', 'rotorua'], dinner: ['auckland'] },
  10: { lunch: ['geraldine', 'fairlie'], dinner: ['tekapo'] },
  11: { lunch: ['mount-cook', 'twizel'], dinner: ['twizel'] },
  12: { lunch: ['wanaka', 'omarama'], dinner: ['wanaka'] },
  13: { lunch: ['queenstown', 'arrowtown'], dinner: ['queenstown', 'arrowtown'] },
  14: { lunch: ['queenstown', 'arrowtown'], dinner: ['queenstown', 'arrowtown'] },
  15: { lunch: ['te-anau', 'queenstown'], dinner: ['te-anau'] },
  16: { lunch: ['te-anau'], dinner: ['queenstown'] },
  17: { lunch: ['queenstown', 'arrowtown'], dinner: ['queenstown', 'arrowtown'] },
  18: { lunch: ['cromwell', 'omarama', 'queenstown'], dinner: ['oamaru'] },
  19: { lunch: ['moeraki', 'oamaru'], dinner: ['christchurch'] },
  20: { lunch: ['christchurch'], dinner: ['christchurch'] },
};

/** Venues in the given towns, in that order, keeping the file's order inside a town. */
export function venuesIn(towns: TownId[]): NzVenue[] {
  return towns.flatMap((t) => NZ_VENUES.filter((v) => v.town === t));
}

/** Towns a meal on this day is likely eaten in; with no meal, every town of the day. */
export function townsFor(day: number, meal?: Meal): TownId[] {
  const towns = DAY_TOWNS[day];
  if (!towns) return [];
  return meal ? towns[meal] : [...new Set([...towns.lunch, ...towns.dinner])];
}

export function venuesForDay(day: number, meal?: Meal): NzVenue[] {
  return venuesIn(townsFor(day, meal));
}

/** Case-insensitive search over every New Zealand venue. */
export function searchNz(query: string): NzVenue[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return NZ_VENUES.filter((v) => {
    const town = townOf(v.town);
    return [v.name, v.nameZh, town.name, town.en, v.categoryLabel, ...v.tags, v.intro].join(' ').toLowerCase().includes(q);
  });
}
