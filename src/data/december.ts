import type { BookedVenue, DayInfo } from './types';

/** The month this site plans: December 2026. */
export const YEAR = 2026;
export const MONTH_INDEX = 11;
export const DAYS_IN_MONTH = 31;

const ADVIEH: BookedVenue = {
  id: 'advieh',
  name: 'Advieh',
  address: 'InterContinental Auckland, 1 Queen St',
  price: '$$$',
  categoryLabel: '中东风味',
  tags: ['分享菜', '酒店餐厅'],
  intro:
    'InterContinental Auckland 里的中东风味餐厅，主厨 Gareth Stewart 用新西兰食材做重香料的分享菜，Cuisine 杂志评 17.5/20。',
  website: '',
};

const KIKA: BookedVenue = {
  id: 'kika',
  name: 'Kika',
  address: '2 Dunmore Street, Wānaka',
  price: '$$$',
  categoryLabel: '新西兰 · 分享菜',
  tags: ['意式 × 亚洲', 'Cuisine 年度休闲餐厅'],
  intro:
    '瓦纳卡溪边的石墙小馆，季节分享菜带意式与亚洲风味，牛肉塔塔配溏心蛋黄、樱桃巧克力帕芙洛娃最受好评；Cuisine 评 18/20。',
  website: 'https://kika.nz',
};

/**
 * What each day of December 2026 looks like, from the trip bookings.
 * Days not listed are plain dates with nothing planned.
 */
export const DAYS: Record<number, DayInfo> = {
  2: { region: 'travel', loc: '北京 → 悉尼', flight: '北京 → 悉尼', plan: '国航航班，从北京飞回悉尼' },
  3: { region: 'syd' },
  4: { region: 'syd' },
  5: { region: 'syd', plan: '明早 06:25 飞奥克兰，晚饭别吃太晚' },
  6: {
    region: 'nz',
    loc: '奥克兰',
    trip: 1,
    flight: '06:25 悉尼 → 奥克兰',
    plan: '12:30 奥克兰机场取车 · 入住 InterContinental',
    booked: { dinner: { venue: ADVIEH, time: '19:30', note: '2 位；可用 FHR 房费抵扣 NZ$170' } },
  },
  7: { region: 'nz', loc: '怀托摩 → 罗托鲁瓦', trip: 2, plan: '14:30 怀托摩萤火虫洞 · 19:45 波利尼西亚温泉' },
  8: { region: 'nz', loc: '罗托鲁瓦', trip: 3, plan: '怀奥塔普地热仙境' },
  9: { region: 'nz', loc: '奥克兰 → 基督城', trip: 4, flight: '19:40 奥克兰 → 基督城', plan: '17:00 奥克兰机场还车' },
  10: { region: 'nz', loc: '特卡波', trip: 5, plan: '09:00 基督城机场取车，开往特卡波湖' },
  11: { region: 'nz', loc: '库克山 · 特威泽尔', trip: 6, plan: '11:00 塔斯曼冰川直升机徒步（10:45 签到）' },
  12: {
    region: 'nz',
    loc: '瓦纳卡',
    trip: 7,
    plan: '入住 Wanaka Lake Studio',
    booked: { dinner: { venue: KIKA, time: '18:00', note: '2 位；订位担保 NZ$50' } },
  },
  13: { region: 'nz', loc: '皇后镇', trip: 8, plan: '10:00 Real Guns 射击' },
  14: { region: 'nz', loc: '皇后镇', trip: 9 },
  15: { region: 'nz', loc: '蒂阿瑙', trip: 10, plan: '入住 Fiordland Hotel' },
  16: { region: 'nz', loc: '米尔福德 → 皇后镇', trip: 11, plan: '10:20 米尔福德峡湾豪华游船' },
  17: { region: 'nz', loc: '皇后镇', trip: 12 },
  18: { region: 'nz', loc: '奥马鲁', trip: 13, plan: '20:45 小蓝企鹅归巢（20:15 签到），晚饭要早' },
  19: { region: 'nz', loc: '基督城', trip: 14, plan: '入住 Crowne Plaza Christchurch' },
  20: { region: 'nz', loc: '基督城 → 悉尼', trip: 15, flight: '晚上 基督城 → 悉尼', plan: '16:00 基督城机场还车' },
  21: { region: 'syd' },
  22: { region: 'syd' },
  23: { region: 'syd' },
  24: { region: 'syd', holiday: '平安夜' },
  25: { region: 'syd', holiday: '圣诞节', plan: '很多餐厅圣诞当天休息，订之前先确认' },
  26: { region: 'syd', holiday: '节礼日' },
  27: { region: 'syd' },
  28: { region: 'syd', holiday: '补假日', plan: '节礼日补假（NSW 公众假期），部分餐厅休息或加收附加费，订之前先确认' },
  29: { region: 'syd' },
  30: { region: 'syd' },
  31: { region: 'syd', holiday: '跨年夜', plan: '跨年夜餐厅多为套餐，通常要提前订' },
};

export const NZ_TRIP_DAYS = Object.values(DAYS).filter((d) => d.region === 'nz').length;

export function dayInfo(day: number): DayInfo {
  return DAYS[day] ?? { region: 'none' };
}

/** Days we are in Sydney, so the Sydney list applies. */
export const SYDNEY_DAYS: number[] = Object.entries(DAYS)
  .filter(([, d]) => d.region === 'syd')
  .map(([k]) => Number(k));
