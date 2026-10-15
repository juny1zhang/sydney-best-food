import { SYDNEY_DAYS } from '../data/december';
import { RESTAURANTS } from '../data/restaurants';
import { closedLabel, closedOn, countMeals, freeSydneyDays, isBooked, mealEntry, removePick, setPick, type Picks } from './plan';

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
    expect(entry?.status === 'picked' && entry.restaurant.id).toBe(first.id);

    const two = setPick(one, 4, 'lunch', { kind: 'custom', name: '楼下面馆', note: '' });
    expect(Object.keys(two[4]!)).toEqual(['dinner', 'lunch']);

    const back = removePick(two, 4, 'lunch');
    expect(back).toEqual(one);
    expect(removePick(back, 4, 'dinner')).toEqual({});
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

  it('counts booked and picked meals', () => {
    expect(countMeals({}, 31)).toEqual({ booked: 2, picked: 0 });
    const picks = setPick(setPick({}, 3, 'lunch', { kind: 'restaurant', id: first.id }), 3, 'dinner', { kind: 'custom', name: 'x', note: '' });
    expect(countMeals(picks, 31)).toEqual({ booked: 2, picked: 2 });
  });

  it('counts a pick marked as booked with the bookings', () => {
    const picks = setPick({}, 22, 'dinner', { kind: 'restaurant', id: first.id, booked: true, time: '19:00' });
    const entry = mealEntry(22, 'dinner', picks)!;
    expect(entry.status).toBe('picked');
    expect(isBooked(entry)).toBe(true);
    expect(countMeals(picks, 31)).toEqual({ booked: 3, picked: 0 });
  });

  it('knows the weekdays a restaurant usually closes', () => {
    // 7 December 2026 is a Monday, 8 December a Tuesday.
    const r = { ...first, closed: [2, 1] };
    expect(closedOn(r, 7)).toBe(true);
    expect(closedOn(r, 8)).toBe(true);
    expect(closedOn(r, 9)).toBe(false);
    expect(closedOn({ ...first, closed: undefined }, 7)).toBe(false);
    expect(closedLabel(r)).toBe('周一、周二休息');
    expect(closedLabel({ ...r, closed: [0, 1] })).toBe('周一、周日休息');
    expect(closedLabel({ ...r, closed: [] })).toBe('');
  });
});
