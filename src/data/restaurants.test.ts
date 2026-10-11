import { CATEGORIES, RESTAURANTS, restaurantsIn, searchRestaurants } from './restaurants';

describe('restaurant data', () => {
  it('has twelve categories, each with ranked restaurants', () => {
    expect(CATEGORIES).toHaveLength(12);
    for (const c of CATEGORIES) {
      const list = restaurantsIn(c.id);
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.map((r) => r.rank)).toEqual(list.map((_, i) => i + 1));
    }
  });

  it('gives every restaurant a unique id, intro and at least one source', () => {
    expect(new Set(RESTAURANTS.map((r) => r.id)).size).toBe(RESTAURANTS.length);
    for (const r of RESTAURANTS) {
      expect(r.intro.length).toBeGreaterThan(10);
      expect(r.sources.length).toBeGreaterThan(0);
      for (const s of r.sources) expect(() => new URL(s)).not.toThrow();
      expect(['$', '$$', '$$$', '$$$$']).toContain(r.price);
    }
  });

  it('searches names, tags and suburbs', () => {
    expect(searchRestaurants('烤鸭').map((r) => r.name)).toContain('Lee Ho Fook Sydney');
    expect(searchRestaurants('surry hills').length).toBeGreaterThan(3);
    expect(searchRestaurants('金沙').map((r) => r.id)).toEqual(['golden-sands']);
    expect(searchRestaurants('   ')).toEqual([]);
  });
});
