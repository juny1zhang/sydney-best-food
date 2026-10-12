import raw from './details.json';

export interface Dish {
  /** As the restaurant writes it. */
  name: string;
  nameZh: string;
  desc: string;
  /** A photo of this dish from the restaurant's own site, if one could be matched. */
  image: string | null;
  /** The page that photo appears on. */
  imageFrom: string | null;
}

export interface Photo {
  image: string;
  imageFrom: string;
  caption: string;
}

/** What a restaurant's own page shows beyond the list entry. */
export interface RestaurantDetail {
  /** How the menu works and roughly what it costs. */
  menu: string;
  menuUrl: string | null;
  dishes: Dish[];
  photos: Photo[];
  /** A caveat worth showing, e.g. the menu changes with the seasons; often empty. */
  note: string;
  sources: string[];
}

interface DetailFile {
  checkedOn: string;
  details: Record<string, RestaurantDetail>;
}

const file = raw as DetailFile;

export const DETAILS_CHECKED_ON = file.checkedOn;

export function detailOf(id: string): RestaurantDetail | undefined {
  return file.details[id];
}
