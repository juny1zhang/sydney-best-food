import { RESTAURANTS } from '../data/restaurants';
import { PENDING_KEY, STORAGE_KEY, loadPending, loadPicks, parsePending, parsePicks, savePending, savePicks } from './storage';

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

  it('keeps unsent changes until there are none left', () => {
    const changes = [
      { day: 4, meal: 'dinner' as const, pick: { kind: 'restaurant' as const, id, booked: true, time: '19:30' } },
      { day: 9, meal: 'lunch' as const, pick: null },
    ];
    savePending(changes);
    expect(loadPending()).toEqual(changes);
    savePending([]);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(loadPending()).toEqual([]);
  });

  it('only reads back unsent changes for real slots, and never turns a bad pick into a clear', () => {
    expect(parsePending(null)).toEqual([]);
    expect(parsePending('not json')).toEqual([]);
    expect(parsePending('{"day":4}')).toEqual([]);
    expect(
      parsePending(
        JSON.stringify([
          { day: 4, meal: 'dinner', pick: { kind: 'restaurant', id } },
          { day: 5, meal: 'dinner', pick: null },
          { day: 0, meal: 'dinner', pick: null },
          { day: 2.5, meal: 'lunch', pick: null },
          { day: 6, meal: 'brunch', pick: null },
          { day: 7, meal: 'lunch', pick: { kind: 'restaurant', id: 'closed-place' } },
          { day: 8, meal: 'lunch' },
          { day: 9, meal: 'lunch', pick: { kind: 'custom', name: ' 小馆 ', booked: 'yes' } },
          'junk',
          null,
        ]),
      ),
    ).toEqual([
      { day: 4, meal: 'dinner', pick: { kind: 'restaurant', id } },
      { day: 5, meal: 'dinner', pick: null },
      { day: 9, meal: 'lunch', pick: { kind: 'custom', name: '小馆', note: '' } },
    ]);
  });

  it('survives storage that throws when keeping unsent changes', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(loadPending()).toEqual([]);
    expect(() => savePending([{ day: 4, meal: 'dinner', pick: null }])).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});
