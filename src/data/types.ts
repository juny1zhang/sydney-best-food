export type Meal = 'lunch' | 'dinner';
export type ServiceMeal = 'breakfast' | Meal;
export type Price = '$' | '$$' | '$$$' | '$$$$';

export type CategoryId =
  | 'chinese'
  | 'hotpot'
  | 'bbq'
  | 'japanese'
  | 'korean'
  | 'se-asian'
  | 'middle-east'
  | 'italian'
  | 'european-bistro'
  | 'modern-au'
  | 'seafood'
  | 'steak-grill'
  | 'brunch-dessert';

export interface Category {
  id: CategoryId;
  /** Full label used on tabs and section headings. */
  name: string;
  /** Compact label used on calendar chips. */
  short: string;
}

export interface Restaurant {
  id: string;
  name: string;
  nameZh: string;
  category: CategoryId;
  /** 1-based rank inside its category. */
  rank: number;
  suburb: string;
  price: Price;
  /** Short accolade labels shown as dark badges. */
  badges: string[];
  tags: string[];
  intro: string;
  booking: string;
  meals: ServiceMeal[];
  website: string;
  /** Full accolade statements as found in the cited sources. */
  accolades: string[];
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  /** What Xiaohongshu posts and comments say; absent until checked. */
  xhs?: XhsTake;
  /** The TripAdvisor listing as last seen; absent until checked. */
  ta?: TaTake;
  /** Weekdays it is usually closed, 0 = Sunday … 6 = Saturday; absent until checked. */
  closed?: number[];
  /** Days of December 2026 it has announced it will be closed, e.g. over Christmas. */
  closedDates?: number[];
  /** Opening days and hours in one short Chinese line, e.g. "周二至周六晚餐，周五、周六有午市". */
  hours?: string;
  /** The page the hours were read from. */
  hoursSource?: string;
}

export interface TaTake {
  url: string | null;
  rating: number | null;
  reviews: number | null;
  /** In Chinese, e.g. "悉尼 4,786 家里第 8". */
  rank: string | null;
  summary: string;
  praise: string[];
  complaints: string[];
}

export type XhsVerdict = 'recommend' | 'mixed' | 'avoid' | 'few';

export interface XhsTake {
  verdict: XhsVerdict;
  /** One sentence, the way a friend would sum it up. */
  summary: string;
  praise: string[];
  complaints: string[];
}

/** A venue booked outside the Sydney list (the New Zealand trip). */
export interface BookedVenue {
  id: string;
  name: string;
  address: string;
  price: Price;
  categoryLabel: string;
  tags: string[];
  intro: string;
  website: string;
}

export interface Booking {
  venue: BookedVenue;
  time: string;
  note: string;
}

export type Region = 'syd' | 'nz' | 'travel' | 'none';

export interface DayInfo {
  region: Region;
  /** Where we are that day; Sydney days omit it. */
  loc?: string;
  /** Day number of the New Zealand trip. */
  trip?: number;
  plan?: string;
  /** A flight that day, e.g. "06:25 悉尼 → 奥克兰". */
  flight?: string;
  holiday?: string;
  booked?: Partial<Record<Meal, Booking>>;
}
