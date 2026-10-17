import { DAYS } from './december';
import { DAY_TOWNS, NZ_VENUES, TOWNS, searchNz, townsFor, venuesForDay, venuesIn } from './nz';
import { RESTAURANTS } from './restaurants';

describe('New Zealand route data', () => {
  it('gives every venue a unique id that cannot clash with the Sydney list', () => {
    const ids = NZ_VENUES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('nz-')).toBe(true);
    const sydney = new Set(RESTAURANTS.map((r) => r.id));
    expect(ids.filter((id) => sydney.has(id))).toEqual([]);
  });

  it('keeps every venue on the route, sourced and described', () => {
    const towns = new Set(TOWNS.map((t) => t.id));
    for (const v of NZ_VENUES) {
      expect(towns.has(v.town)).toBe(true);
      expect(v.intro.length).toBeGreaterThan(15);
      expect(v.meals.length).toBeGreaterThan(0);
      expect(['$', '$$', '$$$', '$$$$']).toContain(v.price);
      expect(['high', 'medium']).toContain(v.confidence);
      // Calendar chips fit about four characters.
      expect((v.categoryShort ?? v.categoryLabel).length, v.name).toBeLessThanOrEqual(4);
      expect(v.sources.length).toBeGreaterThan(0);
      for (const s of v.sources) expect(new URL(s).protocol).toMatch(/^https?:$/);
    }
  });

  it('leaves out the restaurants already booked for the trip', () => {
    expect(NZ_VENUES.filter((v) => /kika|advieh/i.test(v.name))).toEqual([]);
  });

  it('has somewhere to eat for every meal of every New Zealand day', () => {
    const nzDays = Object.entries(DAYS)
      .filter(([, d]) => d.region === 'nz')
      .map(([k]) => Number(k));
    expect(Object.keys(DAY_TOWNS).map(Number)).toEqual(nzDays);
    for (const day of nzDays) {
      for (const meal of ['lunch', 'dinner'] as const) {
        expect(venuesForDay(day, meal).some((v) => v.meals.includes(meal)), `${meal} on day ${day}`).toBe(true);
      }
    }
  });

  it('lists only towns that have venues, and every venue is on some day', () => {
    const routeTowns = new Set(Object.keys(DAY_TOWNS).flatMap((d) => townsFor(Number(d))));
    for (const town of routeTowns) expect(venuesIn([town]).length, town).toBeGreaterThan(0);
    for (const v of NZ_VENUES) expect(routeTowns.has(v.town), v.name).toBe(true);
  });

  it('suggests the towns where each meal is eaten', () => {
    // 18 Dec: lunch on the road, an early dinner in Oamaru before the penguins.
    expect(new Set(venuesForDay(18, 'dinner').map((v) => v.town))).toEqual(new Set(['oamaru']));
    expect(venuesForDay(18, 'lunch')[0].town).toBe('cromwell');
    expect(townsFor(18)).toEqual(['cromwell', 'omarama', 'queenstown', 'oamaru']);
    expect(townsFor(3)).toEqual([]);
  });

  it('searches by English or Chinese town name', () => {
    expect(searchNz('Te Anau').length).toBeGreaterThan(0);
    expect(searchNz('蒂阿瑙')).toEqual(searchNz('te anau'));
    expect(searchNz('  ')).toEqual([]);
  });
});
