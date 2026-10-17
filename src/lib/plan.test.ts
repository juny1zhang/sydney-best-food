import { SYDNEY_DAYS } from '../data/december';
import { RESTAURANTS } from '../data/restaurants';
import {
  countMeals,
  entryName,
  freeSydneyDays,
  isReserved,
  mealEntry,
  planItems,
  removePick,
  reservedTime,
  setPick,
  setReservation,
  type Picks,
} from './plan';

const first = RESTAURANTS[0];

describe('plan', () => {
  it('shows the real bookings from the trip', () => {
    const advieh = mealEntry(6, 'dinner', {});
    expect(advieh?.status).toBe('booked');
    expect(advieh?.status === 'booked' && advieh.booking.venue.name).toBe('Advieh');
    const kika = mealEntry(12, 'dinner', {});
    expect(kika?.status === 'booked' && kika.booking.time).toBe('18:00');
    expect(mealEntry(6, 'lunch', {})).toBeNull();
  });

  it('never lets a pick override a booking', () => {
    const picks = setPick({}, 6, 'dinner', { kind: 'restaurant', id: first.id });
    expect(mealEntry(6, 'dinner', picks)?.status).toBe('booked');
  });

  it('adds and removes picks without mutating the input', () => {
    const empty: Picks = {};
    const one = setPick(empty, 4, 'dinner', { kind: 'restaurant', id: first.id });
    expect(empty).toEqual({});
    const entry = mealEntry(4, 'dinner', one);
    expect(entry?.status === 'picked' && entry.place.id).toBe(first.id);
    expect(entry && entryName(entry)).toBe(first.name);

    const two = setPick(one, 4, 'lunch', { kind: 'custom', name: '楼下面馆', note: '' });
    expect(Object.keys(two[4]!)).toEqual(['dinner', 'lunch']);

    const back = removePick(two, 4, 'lunch');
    expect(back).toEqual(one);
    expect(removePick(back, 4, 'dinner')).toEqual({});
  });

  it('marks and unmarks a reservation on a pick', () => {
    const picked = setPick({}, 4, 'dinner', { kind: 'restaurant', id: first.id });
    expect(isReserved(mealEntry(4, 'dinner', picked)!)).toBe(false);

    const reserved = setReservation(picked, 4, 'dinner', { time: '19:30', note: '2 位' });
    const entry = mealEntry(4, 'dinner', reserved)!;
    expect(isReserved(entry)).toBe(true);
    expect(reservedTime(entry)).toBe('19:30');
    expect(picked[4]!.dinner).not.toHaveProperty('reserved');

    const cleared = setReservation(reserved, 4, 'dinner', null);
    expect(cleared).toEqual(picked);
    // Nothing to reserve on an empty slot.
    expect(setReservation({}, 4, 'lunch', { time: '12:00', note: '' })).toEqual({});
  });

  it('lists only open Sydney days', () => {
    const all = freeSydneyDays('dinner', {});
    expect(all).toEqual(SYDNEY_DAYS);
    expect(all).not.toContain(6);
    expect(all).not.toContain(2);
    const picks = setPick({}, 21, 'dinner', { kind: 'restaurant', id: first.id });
    expect(freeSydneyDays('dinner', picks)).not.toContain(21);
    expect(freeSydneyDays('lunch', picks)).toContain(21);
  });

  it('counts reserved meals as booked and the rest as picked', () => {
    expect(countMeals({})).toEqual({ booked: 2, picked: 0 });
    let picks = setPick(setPick({}, 3, 'lunch', { kind: 'restaurant', id: first.id }), 3, 'dinner', { kind: 'custom', name: 'x', note: '' });
    expect(countMeals(picks)).toEqual({ booked: 2, picked: 2 });
    picks = setReservation(picks, 3, 'dinner', { time: '18:00', note: '' });
    expect(countMeals(picks)).toEqual({ booked: 3, picked: 1 });
  });

  it('lists every planned meal in date order', () => {
    const picks = setPick(setPick({}, 22, 'lunch', { kind: 'restaurant', id: first.id }), 4, 'dinner', { kind: 'custom', name: 'x', note: '' });
    expect(planItems(picks).map((i) => `${i.day}-${i.meal}`)).toEqual(['4-dinner', '6-dinner', '12-dinner', '22-lunch']);
  });
});
