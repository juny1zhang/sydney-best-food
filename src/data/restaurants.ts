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

/** Words that name a whole category, so a match only says "this kind of place". */
const CATEGORY_WORDS: Record<CategoryId, string> = {
  chinese: 'chinese 中国 中餐 中菜',
  hotpot: 'hot pot hotpot 火锅',
  bbq: 'bbq barbecue korean bbq kbbq yakiniku 烤肉 韩烤 烧肉 烤串 烧烤',
  japanese: 'japanese 日本 日料 日餐',
  korean: 'korean 韩国 韩餐',
  'se-asian': 'southeast asian asian 东南亚',
  'middle-east': 'middle eastern mediterranean 中东 地中海',
  italian: 'italian 意大利 意餐',
  'european-bistro': 'european bistro 欧陆 欧洲',
  'modern-au': 'modern australian fine dining 澳洲 现代澳洲',
  seafood: 'seafood 海鲜',
  'steak-grill': 'steakhouse steak grill 牛排',
  'brunch-dessert': 'brunch dessert 早午餐 甜品',
};

/** English words mapped to the Chinese the tags and intros use. */
const SYNONYMS: [string, string[]][] = [
  ['vietnamese', ['越南']],
  ['thai', ['泰']],
  ['malaysian', ['马来']],
  ['indonesian', ['印尼']],
  ['lebanese', ['黎巴嫩']],
  ['turkish', ['土耳其']],
  ['greek', ['希腊']],
  ['french', ['法式', '法餐', '法国']],
  ['cantonese', ['粤菜']],
  ['sichuan', ['川菜']],
  ['yum cha', ['饮茶']],
  ['dim sum', ['点心']],
  ['hot pot', ['火锅']],
  ['hotpot', ['火锅']],
  ['peking duck', ['烤鸭']],
  ['duck', ['烤鸭']],
  ['noodle', ['面馆', '面汤', '拉面', 'biangbiang']],
  ['sushi', ['寿司']],
  ['tempura', ['天妇罗']],
  ['yakitori', ['烧鸟']],
  ['kbbq', ['韩式烤肉', '韩烤']],
  ['yakiniku', ['烧肉']],
  ['skewer', ['烤串']],
  ['korean bbq', ['韩式烤肉']],
  ['pizza', ['披萨']],
  ['pasta', ['意面', '意式饺', '千层面']],
  ['steak', ['牛排']],
  ['bbq', ['烤']],
  ['curry', ['咖喱']],
  ['oyster', ['蚝']],
  ['fish and chips', ['炸鱼薯条']],
  ['burger', ['汉堡']],
  ['brunch', ['早午餐']],
  ['cafe', ['咖啡']],
  ['coffee', ['咖啡']],
  ['bakery', ['烘焙', '面包']],
  ['croissant', ['可颂']],
  ['gelato', ['冰淇淋']],
  ['ice cream', ['冰淇淋']],
  ['dessert', ['甜品', '蛋糕']],
  ['wine bar', ['葡萄酒吧']],
  ['tasting menu', ['品鉴']],
  ['degustation', ['品鉴']],
  ['view', ['景观', '海景']],
];

function terms(q: string): string[] {
  const out = [q];
  for (const [en, zh] of SYNONYMS) if (q.includes(en)) out.push(...zh);
  return out;
}

/**
 * Case-insensitive search. Places whose own name, suburb, tags or intro match come first,
 * best ranked first; places that only match because of their category follow.
 */
export function searchRestaurants(query: string): Restaurant[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = terms(q);
  const direct: Restaurant[] = [];
  const byCategory: Restaurant[] = [];
  for (const r of RESTAURANTS) {
    const own = [r.name, r.nameZh, r.suburb, ...r.tags, r.intro].join(' ').toLowerCase();
    if (words.some((w) => own.includes(w))) direct.push(r);
    else if (`${categoryOf(r.category).name} ${CATEGORY_WORDS[r.category]}`.toLowerCase().includes(q)) byCategory.push(r);
  }
  const byRank = (a: Restaurant, b: Restaurant) => a.rank - b.rank;
  return [...direct.sort(byRank), ...byCategory.sort(byRank)];
}
