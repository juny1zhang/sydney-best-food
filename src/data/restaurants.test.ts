import { CATEGORIES, RESTAURANTS, restaurantsIn, searchRestaurants, sortRestaurants, type SortOrder } from './restaurants';

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

  it('lists matches from the category the query names before matches from elsewhere', () => {
    const steak = searchRestaurants('steak').map((r) => r.id);
    // Steakhouses that mention 牛排, then the brasserie's steak frites, then steakhouses that never say it.
    expect(steak.indexOf('firedoor')).toBeLessThan(steak.indexOf('armorica'));
    expect(steak.indexOf('armorica')).toBeLessThan(steak.indexOf('eleven-barrack'));
  });
});

describe('search words people actually type', () => {
  const ids = (q: string) => searchRestaurants(q).map((r) => r.id);

  it('keeps bbq to barbecue places instead of everything roasted', () => {
    const bbq = searchRestaurants('bbq');
    expect(bbq.map((r) => r.id)).toEqual(expect.arrayContaining(restaurantsIn('bbq').map((r) => r.id)));
    expect(bbq.slice(0, 4).every((r) => r.category === 'bbq')).toBe(true);
    for (const roast of ['lee-ho-fook', 'grandfathers', 'mr-wong', 'kisuke', 'jiu-long-ding']) expect(ids('bbq')).not.toContain(roast);
    expect(bbq.length).toBeLessThan(12);
    expect(ids('barbecue')).toEqual(ids('bbq'));
  });

  it('tells yakiniku and Korean BBQ apart from other things', () => {
    expect(ids('yakiniku')).not.toContain('the-chairman');
    expect(ids('korean bbq')).toEqual(['kangnam']);
    expect(ids('kbbq')).toEqual(['kangnam']);
    const korean = ids('korean');
    expect(korean).toEqual(expect.arrayContaining(['allta', 'sang', 'matkim', 'kangnam']));
    for (const japanese of ['rengaya', 'tajima', 'suminoya']) expect(korean).not.toContain(japanese);
  });

  it('finds breakfast by the meals a place opens for', () => {
    const breakfast = searchRestaurants('breakfast');
    expect(breakfast.map((r) => r.id)).toEqual(expect.arrayContaining(['bills', 'lune', 'tan-viet']));
    expect(breakfast.every((r) => r.meals.includes('breakfast'))).toBe(true);
    expect(ids('brekkie')).toEqual(ids('breakfast'));
  });

  it('answers words that used to find nothing', () => {
    expect(ids('dumplings')).toEqual(expect.arrayContaining(['grandfathers', 'cheng-ji', 'spice-temple', 'mr-wong']));
    // 意式饺 is ravioli.
    expect(ids('dumpling')).not.toContain('pellegrino');
    expect(ids('ramen').length).toBeGreaterThan(0);
    expect(ids('vegetarian')).toEqual(['viand']);
    expect(ids('halal')).toEqual(['temu-kangen', 'sahtein']);
    expect(ids('noodles')).toEqual(expect.arrayContaining(['xian-eatery', 'cheng-ji', 'tan-viet', 'ho-jiak']));
    expect(ids('dim sum')).toEqual(expect.arrayContaining(['mr-wong', 'xopp', 'palace']));
    expect(ids('bao')).toEqual(['palace']);
    expect(ids('pho')).toEqual(['tan-viet']);
    expect(ids('laksa')).toEqual(['ho-jiak']);
    expect(ids('oysters')).toEqual(['catalina']);
    expect(ids('coffee')).toEqual(['grounds']);
    expect(ids('gelato')).toEqual(['messina', 'cow-moon', 'ciccone']);
    const omakase = searchRestaurants('omakase');
    expect(omakase.length).toBeGreaterThanOrEqual(5);
    expect(omakase.every((r) => `${r.tags.join(' ')} ${r.intro}`.toLowerCase().includes('omakase'))).toBe(true);
  });

  it('reads wagyu, fish & chips and friends the way they are written', () => {
    const wagyu = ids('wagyu');
    expect(wagyu).toEqual(expect.arrayContaining(['rengaya', 'tajima', 'rockpool', 'memory-tongue']));
    // "海鲜塔和牛排薯条" is a seafood tower and steak frites, not wagyu.
    expect(wagyu).not.toContain('armorica');
    expect(ids('fish & chips')).toEqual(['fich', 'fish-rocks', 'doyles']);
    expect(ids('fish n chips')).toEqual(ids('fish & chips'));
    expect(ids('t-bone')).toEqual(expect.arrayContaining(['bistecca', 'woodcut']));
    expect(ids('byo')).toEqual(expect.arrayContaining(['spice-i-am', 'olympic-meats']));
  });

  it('matches whole words, and ignores accents, case and curly apostrophes', () => {
    expect(ids('porkfat')).toEqual(['porkfat']);
    expect(ids('mala')).toEqual(['jiu-long-ding']);
    expect(ids('malaysian')).not.toContain('jiu-long-ding');
    expect(ids('pancakes')).toEqual(['bills']);
    expect(ids('porteno')).toEqual(['porteno']);
    expect(ids("gigi's")).toEqual(['gigis']);
    expect(ids('BBQ')).toEqual(ids('bbq'));
  });
});

describe('sorting', () => {
  const chinese = restaurantsIn('chinese');
  const order = (o: SortOrder, list = chinese) => sortRestaurants(list, o).map((r) => r.id);

  it('keeps the incoming order for the default ranking', () => {
    expect(order('rank')).toEqual(chinese.map((r) => r.id));
    const found = searchRestaurants('dumplings');
    expect(order('rank', found)).toEqual(found.map((r) => r.id));
  });

  it('puts Xiaohongshu favourites first, then mixed, then quiet, then panned', () => {
    expect(order('xhs')).toEqual(['the-chairman', 'palace', 'cheng-ji', 'lee-ho-fook', 'grandfathers', 'mr-wong', 'xopp', 'spice-temple', 'xian-eatery']);
    const weight = (v: string | undefined) => (v === 'recommend' ? 0 : v === 'mixed' ? 1 : v === 'avoid' ? 3 : 2);
    for (const c of CATEGORIES) {
      const sorted = sortRestaurants(restaurantsIn(c.id), 'xhs');
      for (let i = 1; i < sorted.length; i++) {
        const a = weight(sorted[i - 1].xhs?.verdict);
        const b = weight(sorted[i].xhs?.verdict);
        expect(a < b || (a === b && sorted[i - 1].rank < sorted[i].rank)).toBe(true);
      }
    }
  });

  it('only trusts TripAdvisor scores with at least 20 reviews', () => {
    // Grandfathers' 4.5 rests on 4 reviews, so it waits with the unrated places, by rank.
    expect(order('ta')).toEqual(['mr-wong', 'spice-temple', 'palace', 'xopp', 'lee-ho-fook', 'grandfathers', 'the-chairman', 'xian-eatery', 'cheng-ji']);
    const steak = sortRestaurants(restaurantsIn('steak-grill'), 'ta').map((r) => r.id);
    // 20 Chapel's 5.0 comes from a single review.
    expect(steak.indexOf('20-chapel')).toBeGreaterThan(steak.indexOf('firedoor'));
  });

  it('breaks rating ties by the number of reviews', () => {
    const tied = RESTAURANTS.filter((r) => r.ta?.rating === 4.3 && (r.ta.reviews ?? 0) >= 20);
    expect(tied.length).toBeGreaterThan(2);
    const sorted = sortRestaurants(tied, 'ta');
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].ta!.reviews!).toBeGreaterThanOrEqual(sorted[i].ta!.reviews!);
  });

  it('sorts by price both ways, rank breaking ties', () => {
    expect(order('price-asc')).toEqual(['xian-eatery', 'cheng-ji', 'the-chairman', 'palace', 'grandfathers', 'mr-wong', 'xopp', 'spice-temple', 'lee-ho-fook']);
    expect(order('price-desc')).toEqual(['lee-ho-fook', 'grandfathers', 'mr-wong', 'xopp', 'spice-temple', 'the-chairman', 'palace', 'xian-eatery', 'cheng-ji']);
  });

  it('leaves the list it was given alone', () => {
    const before = chinese.map((r) => r.id);
    sortRestaurants(chinese, 'price-asc');
    expect(chinese.map((r) => r.id)).toEqual(before);
  });
});
