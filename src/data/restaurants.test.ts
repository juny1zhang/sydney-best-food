import { CATEGORIES, RESTAURANTS, restaurantsIn, searchRestaurants } from './restaurants';

describe('restaurant data', () => {
  it('has thirteen categories, each with ranked restaurants', () => {
    expect(CATEGORIES).toHaveLength(13);
    for (const c of CATEGORIES) {
      const list = restaurantsIn(c.id);
      expect(list.length).toBeGreaterThanOrEqual(3);
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
    expect(searchRestaurants('舌尖记忆').map((r) => r.id)).toEqual(['memory-tongue']);
    expect(searchRestaurants('   ')).toEqual([]);
  });
});

describe('search keywords', () => {
  it('finds categories by common English words', () => {
    expect(searchRestaurants('pizza').every((r) => r.category === 'italian')).toBe(true);
    expect(searchRestaurants('yum cha').length).toBeGreaterThanOrEqual(2);
    expect(searchRestaurants('brunch').some((r) => r.id === 'bills')).toBe(true);
  });
});

describe('search ranking', () => {
  it('puts places that really match ahead of category-only matches', () => {
    expect(searchRestaurants('火锅')[0].id).toBe('memory-tongue');
    expect(searchRestaurants('hot pot').every((r) => r.category === 'hotpot')).toBe(true);
    expect(searchRestaurants('yakiniku').map((r) => r.id)).toEqual(expect.arrayContaining(['rengaya', 'tajima', 'suminoya']));
    expect(searchRestaurants('vietnamese').map((r) => r.id)).toEqual(['tan-viet']);
    expect(searchRestaurants('yum cha').every((r) => r.category === 'chinese')).toBe(true);
    const japanese = searchRestaurants('japanese');
    expect(japanese.length).toBe(7);
    expect(japanese.every((r) => r.category === 'japanese')).toBe(true);
  });
});
