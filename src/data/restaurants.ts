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

/** Extra words people search a category by, in English and Chinese. */
const CATEGORY_KEYWORDS: Record<CategoryId, string> = {
  chinese: 'chinese cantonese sichuan yum cha dim sum hot pot 粤菜 川菜 点心 饮茶 火锅 中国',
  japanese: 'japanese sushi omakase izakaya ramen tempura yakitori 寿司 日本 居酒屋 天妇罗',
  korean: 'korean kbbq korean bbq 韩国 烤肉',
  'se-asian': 'thai vietnamese malaysian indonesian southeast asian 泰国 越南 马来 印尼 叻沙',
  indian: 'indian sri lankan curry dosa 印度 斯里兰卡 咖喱',
  'middle-east': 'middle eastern lebanese turkish greek mediterranean 黎巴嫩 土耳其 希腊 地中海',
  italian: 'italian pasta pizza 意大利 意面 披萨',
  'european-bistro': 'french bistro brasserie european wine bar 法国 法式 欧洲 酒吧',
  'modern-au': 'modern australian fine dining degustation tasting menu 澳洲 品鉴 精致',
  seafood: 'seafood fish oyster fish and chips 海鲜 鱼 生蚝 炸鱼薯条',
  'steak-grill': 'steak steakhouse grill bbq 牛排 烧烤',
  'brunch-dessert': 'brunch breakfast cafe coffee bakery dessert gelato ice cream croissant 早午餐 早餐 咖啡 甜品 面包 冰淇淋 可颂',
};

/** Case-insensitive search over name, Chinese name, suburb, category, tags and intro. */
export function searchRestaurants(query: string): Restaurant[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return RESTAURANTS.filter((r) => {
    const hay = [r.name, r.nameZh, r.suburb, categoryOf(r.category).name, CATEGORY_KEYWORDS[r.category], ...r.tags, r.intro]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => a.rank - b.rank);
}
