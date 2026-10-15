import raw from './restaurants.json';
import type { Category, CategoryId, Restaurant, XhsVerdict } from './types';

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
  // Korean BBQ goes through SYNONYMS instead, so "korean" alone doesn't pull in Japanese yakiniku.
  bbq: 'bbq barbecue yakiniku 烤肉 烧肉 烤串 烧烤',
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

type Term = string | RegExp;

const CHEAP: Term[] = ['平价', '性价比', '实惠', '不贵'];

/**
 * Words people type, mostly English, mapped to what the tags and intros actually say.
 * Each word matches whole (plural allowed), so "pork" leaves "Porkfat" alone and "mala" leaves "malaysian" alone.
 */
const SYNONYMS: [string, Term[]][] = [
  ['vietnamese', ['越南']],
  ['thai', ['泰']],
  ['malaysian', ['马来']],
  ['indonesian', ['印尼']],
  ['lebanese', ['黎巴嫩']],
  ['turkish', ['土耳其']],
  ['greek', ['希腊']],
  ['argentinian', ['阿根廷']],
  ['argentine', ['阿根廷']],
  ['french', ['法式', '法餐', '法国']],
  ['cantonese', ['粤菜']],
  ['sichuan', ['川菜', '川渝']],
  ['szechuan', ['川菜', '川渝']],
  ['hunan', ['湘菜']],
  ['chongqing', ['重庆']],
  ['xian', ['西安', '陕西']],
  ['shaanxi', ['陕西']],
  ['halal', ['清真']],
  ['vegetarian', ['素食']],
  ['vegan', ['素食']],
  ['yum cha', ['饮茶', '点心']],
  ['dim sum', ['饮茶', '点心']],
  ['dumpling', ['饺子', '锅贴', '云吞', '点心']],
  ['bao', ['叉烧包']],
  ['char siu', ['叉烧']],
  ['hot pot', ['火锅']],
  ['hotpot', ['火锅']],
  ['mala', ['麻辣']],
  ['spicy', ['辣', '川菜', '湘菜', '重庆']],
  ['peking duck', ['烤鸭']],
  ['duck', ['烤鸭']],
  ['noodle', ['面馆', '面汤', '面食', '拉面', '叻沙', '虾面', 'biangbiang']],
  // No ramen bar made the list; the noodle-soup houses are the nearest thing.
  ['ramen', ['拉面', '面馆', '面汤']],
  ['pho', ['河粉', '越南']],
  ['laksa', ['叻沙']],
  ['fried rice', ['炒饭']],
  ['sushi', ['寿司']],
  ['sashimi', ['刺身']],
  ['tempura', ['天妇罗']],
  ['udon', ['乌冬']],
  ['kaiseki', ['怀石']],
  ['izakaya', ['居酒屋']],
  ['yakitori', ['烧鸟']],
  ['korean bbq', ['韩式烤肉']],
  ['korean barbecue', ['韩式烤肉']],
  ['kbbq', ['韩式烤肉']],
  ['韩烤', ['韩式烤肉']],
  // Japanese-style only: a bare 烧肉 also finds the Chairman's 红烧肉 (red-braised pork).
  ['yakiniku', ['日式烧肉']],
  // Not a bare 烤, which is in 烤鸭, 烤物 and half the intros.
  ['bbq', ['烤肉', '烧烤', '日式烧肉']],
  ['barbecue', ['烤肉', '烧烤', '日式烧肉']],
  ['charcoal', ['炭火', '炭烤']],
  ['skewer', ['烤串', '串烧']],
  ['satay', ['沙爹']],
  ['rendang', ['仁当']],
  ['nasi lemak', ['椰浆饭']],
  ['curry', ['咖喱', '仁当']],
  ['pizza', ['披萨']],
  ['neapolitan', ['那不勒斯']],
  ['sourdough', ['酸面团']],
  ['pasta', ['意面', '意式饺', '千层面']],
  ['ravioli', ['意式饺']],
  ['steak', ['牛排']],
  ['dry aged', ['干式熟成']],
  ['t bone', ['t 骨']],
  ['tbone', ['t 骨']],
  ['tomahawk', ['战斧']],
  ['wood fire', ['柴火']],
  ['wood fired', ['柴火']],
  ['woodfire', ['柴火']],
  ['woodfired', ['柴火']],
  // Skips "海鲜塔和牛排薯条": a seafood tower and steak frites.
  ['wagyu', [/和牛(?!排)/]],
  ['lamb', ['羊肉']],
  ['pork', ['猪肉', '猪排', '乳猪', '猪头', '猪油', '叉烧']],
  ['chicken', ['炸鸡', '烤鸡', '鸡肉', '鸡面', '沙爹鸡', '烧鸟']],
  ['fried chicken', ['炸鸡']],
  ['oyster', ['蚝']],
  ['crab', ['蟹']],
  ['fish and chip', ['炸鱼薯条']],
  ['fish n chip', ['炸鱼薯条']],
  ['chip', ['薯条']],
  ['burger', ['汉堡']],
  ['brunch', ['早午餐']],
  ['pancake', ['松饼']],
  ['hotcake', ['松饼']],
  ['cafe', ['咖啡']],
  ['coffee', ['咖啡']],
  ['bakery', ['烘焙', '面包坊']],
  ['bakeries', ['烘焙', '面包坊']],
  ['pastry', ['烘焙', '甜点', '可颂']],
  ['pastries', ['烘焙', '甜点', '可颂']],
  ['croissant', ['可颂']],
  ['cake', ['蛋糕']],
  ['lamington', ['拉明顿']],
  ['gelato', ['冰淇淋']],
  ['ice cream', ['冰淇淋']],
  ['sorbet', ['雪葩']],
  ['dessert', ['甜品', '甜点', '蛋糕']],
  ['wine', ['葡萄酒', '酒窖', '酒单', '侍酒师']],
  ['wine bar', ['葡萄酒吧']],
  ['cocktail', ['鸡尾酒']],
  ['whisky', ['威士忌']],
  ['whiskey', ['威士忌']],
  ['sake', ['清酒']],
  ['byo', ['自带酒水']],
  ['tasting menu', ['品鉴']],
  ['degustation', ['品鉴']],
  ['fine dining', ['精致餐饮', '精致餐厅']],
  ['buffet', ['自助']],
  ['all you can eat', ['自助']],
  ['cheap', CHEAP],
  ['budget', CHEAP],
  ['affordable', CHEAP],
  ['late night', ['深夜', '夜宵']],
  ['date', ['约会']],
  ['date night', ['约会']],
  ['romantic', ['约会']],
  ['anniversary', ['纪念日']],
  ['special occasion', ['纪念日', '特别场合', '庆祝']],
  ['jazz', ['爵士']],
  ['view', ['景观', '海景']],
  ['harbour', ['海港']],
  ['harbor', ['海港']],
  ['opera house', ['歌剧院']],
  ['beach', ['海滩', '海边']],
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Longest first, so "korean bbq" is used up before "bbq" gets a look. */
const SYNONYM_RULES = SYNONYMS.map(([word, found]) => ({
  pattern: new RegExp(`(^|[^a-z])${escapeRegExp(word)}(?:e?s)?(?![a-z])`),
  found,
  length: word.length,
})).sort((a, b) => b.length - a.length);

/** Asking for breakfast means places that open for it, whatever their intro says. */
const BREAKFAST = /(^|[^a-z])(breakfast|brekkie)(?![a-z])|早餐|早饭/;

/** Lower case, accents dropped ("Porteño" → "porteno"), full-width letters and curly apostrophes made plain. */
function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’]/g, "'");
}

const OWN_TEXT = new Map(RESTAURANTS.map((r) => [r.id, fold([r.name, r.nameZh, r.suburb, ...r.tags, r.intro].join(' '))]));
const CATEGORY_TEXT = new Map(CATEGORIES.map((c) => [c.id, fold(`${c.name} ${CATEGORY_WORDS[c.id]}`)]));

function terms(q: string): Term[] {
  const out: Term[] = [q];
  let rest = q.replace(/\s*&\s*/g, ' and ').replace(/-/g, ' ');
  for (const rule of SYNONYM_RULES) {
    if (!rule.pattern.test(rest)) continue;
    out.push(...rule.found);
    rest = rest.replace(rule.pattern, '$1 ');
  }
  return out;
}

function hit(text: string, term: Term): boolean {
  return typeof term === 'string' ? text.includes(term) : term.test(text);
}

/**
 * Case- and accent-insensitive search. Places whose own name, suburb, tags or intro match come first,
 * those from a category the query names ahead of the rest; places that only match because of their
 * category follow. Each group is best ranked first.
 */
export function searchRestaurants(query: string): Restaurant[] {
  const q = fold(query.trim());
  if (!q) return [];
  const words = terms(q);
  const forBreakfast = BREAKFAST.test(q);
  const named = new Set(CATEGORIES.filter((c) => CATEGORY_TEXT.get(c.id)!.includes(q)).map((c) => c.id));
  const inNamed: Restaurant[] = [];
  const elsewhere: Restaurant[] = [];
  const byCategory: Restaurant[] = [];
  for (const r of RESTAURANTS) {
    const own = OWN_TEXT.get(r.id)!;
    if (words.some((w) => hit(own, w)) || (forBreakfast && r.meals.includes('breakfast'))) {
      (named.has(r.category) ? inNamed : elsewhere).push(r);
    } else if (named.has(r.category)) byCategory.push(r);
  }
  const byRank = (a: Restaurant, b: Restaurant) => a.rank - b.rank;
  return [...inNamed.sort(byRank), ...elsewhere.sort(byRank), ...byCategory.sort(byRank)];
}

export type SortOrder = 'rank' | 'xhs' | 'ta' | 'price-asc' | 'price-desc';

/** Same cut-off as the TripAdvisor chip: below it a score says more about luck than the restaurant. */
const MIN_TA_REVIEWS = 20;

const XHS_ORDER: Record<XhsVerdict, number> = { recommend: 0, mixed: 1, few: 2, avoid: 3 };

function xhsOrder(r: Restaurant): number {
  return XHS_ORDER[r.xhs?.verdict ?? 'few'];
}

/** The TripAdvisor rating, when enough people have rated it to mean something. */
function taRating(r: Restaurant): number | null {
  return r.ta?.rating != null && (r.ta.reviews ?? 0) >= MIN_TA_REVIEWS ? r.ta.rating : null;
}

function compareTa(a: Restaurant, b: Restaurant): number {
  const ra = taRating(a);
  const rb = taRating(b);
  if (ra === null || rb === null) return (ra === null ? 1 : 0) - (rb === null ? 1 : 0);
  return rb - ra || (b.ta?.reviews ?? 0) - (a.ta?.reviews ?? 0);
}

/**
 * A list in another order. "rank" keeps the order it came in (rank in a category, relevance in search results);
 * the others fall back to rank, then to that order, on ties.
 */
export function sortRestaurants(list: readonly Restaurant[], order: SortOrder): Restaurant[] {
  const byRank = (a: Restaurant, b: Restaurant) => a.rank - b.rank;
  const by = (key: (a: Restaurant, b: Restaurant) => number) => [...list].sort((a, b) => key(a, b) || byRank(a, b));
  switch (order) {
    case 'rank':
      return [...list];
    case 'xhs':
      return by((a, b) => xhsOrder(a) - xhsOrder(b));
    case 'ta':
      return by(compareTa);
    case 'price-asc':
      return by((a, b) => a.price.length - b.price.length);
    case 'price-desc':
      return by((a, b) => b.price.length - a.price.length);
  }
}
