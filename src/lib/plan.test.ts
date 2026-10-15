import { SYDNEY_DAYS } from '../data/december';
import { RESTAURANTS } from '../data/restaurants';
import type { Restaurant } from '../data/types';
import { closedLabel, closedOn, closedReason, decemberDates, countMeals, defaultMeal, freeSydneyDays, isBooked, mealEntry, removePick, setPick, withReservation, type Pick, type Picks } from './plan';

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
    expect(closedLabel(r)).toBe('通常周一、周二休息');
    expect(closedLabel({ ...r, closed: [0, 1] })).toBe('通常周一、周日休息');
    expect(closedLabel({ ...r, closed: [] })).toBe('');
    expect(closedReason(r, 7)).toBe('周一通常休息');
    expect(closedReason(r, 9)).toBe('');
  });

  it('knows the December dates a restaurant has announced it is closed', () => {
    // 25 December 2026 is a Friday.
    const r = { ...first, closed: [1], closedDates: [26, 25, 31] };
    expect(closedOn(r, 25)).toBe(true);
    expect(closedOn(r, 24)).toBe(false);
    expect(closedOn(r, 21)).toBe(true);
    expect(closedReason(r, 25)).toBe('12月25日休息');
    expect(closedReason(r, 21)).toBe('周一通常休息');
    expect(closedLabel(r)).toBe('通常周一休息；12月25、26、31日休息');
    expect(closedLabel({ ...r, closed: undefined, closedDates: [25, 26, 27, 28, 29, 30, 31] })).toBe('12月25日至31日休息');
  });

  it('writes December dates compactly', () => {
    expect(decemberDates([25])).toBe('12月25日');
    expect(decemberDates([28, 25, 26])).toBe('12月25、26、28日');
    expect(decemberDates([24, 25, 26, 31])).toBe('12月24日至26日、31日');
  });

  it('marks a pick booked and back without touching the original', () => {
    const pick: Pick = { kind: 'restaurant', id: first.id };
    const booked = withReservation(pick, true, '19:30');
    expect(booked).toEqual({ kind: 'restaurant', id: first.id, booked: true, time: '19:30' });
    expect(pick).toEqual({ kind: 'restaurant', id: first.id });
    expect(withReservation(pick, true)).toEqual({ kind: 'restaurant', id: first.id, booked: true });
    // Taking the booking off drops the old time too.
    expect(withReservation(booked, false)).toEqual(pick);
    // Booking again without a time forgets the earlier one.
    expect(withReservation(booked, true, '')).toEqual({ kind: 'restaurant', id: first.id, booked: true });
    const custom: Pick = { kind: 'custom', name: '楼下面馆', note: '靠窗', booked: true, time: '12:00' };
    expect(withReservation(custom, false)).toEqual({ kind: 'custom', name: '楼下面馆', note: '靠窗' });
  });

  it('offers the meal a restaurant actually serves', () => {
    const both = { ...first, meals: ['lunch', 'dinner'] as Restaurant['meals'] };
    const dinnerOnly = { ...first, meals: ['dinner'] as Restaurant['meals'] };
    const brunch = { ...first, meals: ['breakfast', 'lunch'] as Restaurant['meals'] };
    const breakfastOnly = { ...first, meals: ['breakfast'] as Restaurant['meals'] };
    expect(defaultMeal(both, 'lunch')).toBe('lunch');
    expect(defaultMeal(both, 'dinner')).toBe('dinner');
    expect(defaultMeal(dinnerOnly, 'lunch')).toBe('dinner');
    expect(defaultMeal(dinnerOnly, 'dinner')).toBe('dinner');
    expect(defaultMeal(brunch, 'dinner')).toBe('lunch');
    // Serves neither: keep what was asked for.
    expect(defaultMeal(breakfastOnly, 'dinner')).toBe('dinner');
    expect(defaultMeal(breakfastOnly, 'lunch')).toBe('lunch');
  });
});
