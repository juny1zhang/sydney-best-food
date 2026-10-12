export type Meal = 'lunch' | 'dinner';
export type ServiceMeal = 'breakfast' | Meal;
export type Price = '$' | '$$' | '$$$' | '$$$$';

export type CategoryId =
  | 'chinese'
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
