import { RESTAURANTS } from '../data/restaurants';
import { countPicks, decodePlan, encodePlan, mergePicks, shareUrl, SHARE_PREFIX } from './share';
import type { Picks } from './plan';

const a = RESTAURANTS[0].id;
const b = RESTAURANTS[1].id;

describe('share links', () => {
  it('round-trips picks with Chinese text and a reservation', () => {
    const picks: Picks = {
      4: { dinner: { kind: 'restaurant', id: a, reserved: { time: '19:00', note: '靠窗' } } },
      22: { lunch: { kind: 'custom', name: '楼下面馆', note: '带现金' } },
    };
    const url = shareUrl({ picks, wishlist: [b] }, 'https://example.com/');
    expect(url.startsWith(`https://example.com/${SHARE_PREFIX}`)).toBe(true);
    // URL-safe base64: no characters that need escaping in a link.
    expect(url.split(SHARE_PREFIX)[1]).toMatch(/^[A-Za-z0-9_-]+$/);
    const hash = url.slice(url.indexOf('#'));
    expect(decodePlan(hash)).toEqual({ picks, wishlist: [b] });
  });

  it('rejects broken, foreign or empty links', () => {
    expect(decodePlan('')).toBeNull();
    expect(decodePlan('#list')).toBeNull();
    expect(decodePlan(`${SHARE_PREFIX}%%%`)).toBeNull();
    expect(decodePlan(`${SHARE_PREFIX}${btoa('{"v":2,"p":{}}')}`)).toBeNull();
    expect(decodePlan(`${SHARE_PREFIX}${encodePlan({ picks: {}, wishlist: [] })}`)).toBeNull();
    // Unknown places are dropped rather than imported.
    const sneaky = encodePlan({ picks: { 4: { dinner: { kind: 'restaurant', id: 'not-a-place' } } }, wishlist: ['nope', a] });
    expect(decodePlan(`${SHARE_PREFIX}${sneaky}`)).toEqual({ picks: {}, wishlist: [a] });
  });

  it('merges shared picks over mine, meal by meal', () => {
    const mine: Picks = { 4: { lunch: { kind: 'restaurant', id: a }, dinner: { kind: 'restaurant', id: a } } };
    const theirs: Picks = { 4: { dinner: { kind: 'restaurant', id: b } }, 5: { lunch: { kind: 'restaurant', id: b } } };
    expect(mergePicks(mine, theirs)).toEqual({
      4: { lunch: { kind: 'restaurant', id: a }, dinner: { kind: 'restaurant', id: b } },
      5: { lunch: { kind: 'restaurant', id: b } },
    });
    expect(countPicks(mergePicks(mine, theirs))).toBe(3);
  });
});
