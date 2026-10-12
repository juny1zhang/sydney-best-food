import raw from './details.json';
import { RESTAURANT_BY_ID } from './restaurants';
import type { RestaurantDetail } from './details';

const details = (raw as { details: Record<string, RestaurantDetail> }).details;
/** Images must come from the restaurants' own sites, never social media, review sites or stock libraries. */
const BANNED = /instagram|fbcdn|facebook|googleusercontent|tripadvisor|yelp|broadsheet|timeout|smh\.com\.au|goodfood|concreteplayground|unsplash|pexels/;

describe('restaurant details', () => {
  it('only describes restaurants on the list', () => {
    for (const id of Object.keys(details)) expect(RESTAURANT_BY_ID.has(id), id).toBe(true);
  });

  it('gives each one a menu overview, a few named dishes and sources', () => {
    for (const [id, d] of Object.entries(details)) {
      expect(d.menu.length, id).toBeGreaterThan(20);
      expect(d.dishes.length, id).toBeGreaterThanOrEqual(2);
      for (const dish of d.dishes) {
        expect(dish.name, id).toBeTruthy();
        expect(dish.desc, id).toBeTruthy();
      }
      expect(d.sources.length, id).toBeGreaterThan(0);
    }
  });

  it('credits every image to an https page on an allowed site', () => {
    const images = Object.values(details).flatMap((d) => [
      ...d.dishes.filter((x) => x.image).map((x) => [x.image!, x.imageFrom] as const),
      ...d.photos.map((p) => [p.image, p.imageFrom] as const),
    ]);
    for (const [image, from] of images) {
      expect(new URL(image).protocol).toBe('https:');
      expect(from && new URL(from).protocol).toBe('https:');
      expect(new URL(image).hostname).not.toMatch(BANNED);
    }
  });
});
