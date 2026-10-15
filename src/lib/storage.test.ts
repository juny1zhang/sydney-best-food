import { RESTAURANTS } from '../data/restaurants';
import { STORAGE_KEY, loadPicks, parsePicks, savePicks } from './storage';

const id = RESTAURANTS[0].id;

describe('storage', () => {
  it('round-trips picks through localStorage', () => {
    const picks = { 4: { dinner: { kind: 'restaurant' as const, id } }, 22: { lunch: { kind: 'custom' as const, name: '饺子馆', note: '带现金' } } };
    savePicks(picks);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(picks);
    expect(loadPicks()).toEqual(picks);
  });

  it('ignores corrupt or unexpected data', () => {
    expect(parsePicks(null)).toEqual({});
    expect(parsePicks('not json')).toEqual({});
    expect(parsePicks('[1,2]')).toEqual({});
    expect(
      parsePicks(
        JSON.stringify({
          0: { dinner: { kind: 'restaurant', id } },
          40: { dinner: { kind: 'restaurant', id } },
          5: { dinner: { kind: 'restaurant', id: 'closed-place' }, brunch: { kind: 'restaurant', id }, lunch: { kind: 'custom', name: '  ' } },
          7: { lunch: { kind: 'custom', name: ' 当地小馆 ' } },
        }),
      ),
    ).toEqual({ 7: { lunch: { kind: 'custom', name: '当地小馆', note: '' } } });
  });

  it('survives storage that throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadPicks()).toEqual({});
    spy.mockRestore();
  });

  it('keeps a booking mark and a well-formed time, nothing else', () => {
    expect(
      parsePicks(
        JSON.stringify({
          4: { dinner: { kind: 'restaurant', id, booked: true, time: '19:30' } },
          5: { dinner: { kind: 'restaurant', id, booked: 'yes', time: '19:30' } },
          6: { lunch: { kind: 'custom', name: '小馆', note: '', booked: true, time: '7pm' } },
        }),
      ),
    ).toEqual({
      4: { dinner: { kind: 'restaurant', id, booked: true, time: '19:30' } },
      5: { dinner: { kind: 'restaurant', id } },
      6: { lunch: { kind: 'custom', name: '小馆', note: '', booked: true } },
    });
  });
});
