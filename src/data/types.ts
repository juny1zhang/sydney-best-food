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

/** Stops on the New Zealand road trip that have eating suggestions. */
export type TownId =
  | 'auckland'
  | 'waitomo'
  | 'rotorua'
  | 'matamata'
  | 'christchurch'
  | 'geraldine'
  | 'fairlie'
  | 'tekapo'
  | 'mount-cook'
  | 'twizel'
  | 'wanaka'
  | 'queenstown'
  | 'arrowtown'
  | 'te-anau'
  | 'cromwell'
  | 'omarama'
  | 'oamaru'
  | 'moeraki';

export interface Town {
  id: TownId;
  /** Chinese name shown in the UI. */
  name: string;
  en: string;
}

/** A recommended place to eat on the New Zealand route. */
export interface NzVenue {
  id: string;
  name: string;
  nameZh: string;
  town: TownId;
  categoryLabel: string;
  /** Compact label for calendar chips when categoryLabel is longer than about four characters. */
  categoryShort?: string;
  price: Price;
  badges: string[];
  tags: string[];
  intro: string;
  booking: string;
  meals: ServiceMeal[];
  address: string;
  website: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
}

/** Anything that can be picked for a meal, in the shape the UI shows it. */
export interface Place {
  id: string;
  /** Which list it comes from: the Sydney board or the New Zealand route. */
  region: 'syd' | 'nz';
  name: string;
  nameZh: string;
  /** Suburb in Sydney, or the Chinese town name in New Zealand. */
  area: string;
  price: Price;
  categoryLabel: string;
  /** Compact label for calendar chips. */
  categoryShort: string;
  /** "中餐第 1 名" on the Sydney board, the town in New Zealand. */
  rankLabel: string;
  badges: string[];
  tags: string[];
  intro: string;
  booking: string;
  meals: ServiceMeal[];
  website: string;
  /** Street address or locality, for calendar events. */
  address: string;
  /** Text for a Google Maps search. */
  mapsQuery: string;
  accolades: string[];
  sources: string[];
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
  holiday?: string;
  booked?: Partial<Record<Meal, Booking>>;
}
