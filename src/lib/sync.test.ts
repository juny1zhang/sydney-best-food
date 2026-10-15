import { RESTAURANTS } from '../data/restaurants';
import { PLAN_ID, applyChange, diffPicks, rowToChange, sharedRemote } from './sync';

const id = RESTAURANTS[0].id;
const other = RESTAURANTS[1].id;

describe('sync', () => {
  it('never connects tests to the real shared plan', () => {
    expect(sharedRemote).toBeNull();
  });

  it('diffs only the slots that changed', () => {
    const prev = { 4: { dinner: { kind: 'restaurant' as const, id } }, 9: { lunch: { kind: 'custom' as const, name: '小馆', note: '' } } };
    const next = { 4: { dinner: { kind: 'restaurant' as const, id: other } }, 9: { lunch: { kind: 'custom' as const, name: '小馆', note: '' } }, 22: { lunch: { kind: 'restaurant' as const, id } } };
    expect(diffPicks(prev, next)).toEqual([
      { day: 4, meal: 'dinner', pick: { kind: 'restaurant', id: other } },
      { day: 22, meal: 'lunch', pick: { kind: 'restaurant', id } },
    ]);
    expect(diffPicks(next, {})).toHaveLength(3);
    expect(diffPicks(next, next)).toEqual([]);
    const booked = { ...next, 4: { dinner: { kind: 'restaurant' as const, id: other, booked: true, time: '19:00' } } };
    expect(diffPicks(next, booked)).toEqual([{ day: 4, meal: 'dinner', pick: booked[4].dinner }]);
  });

  it('applies a change, keeping the same object when nothing moves', () => {
    const picks = applyChange({}, { day: 5, meal: 'lunch', pick: { kind: 'restaurant', id } });
    expect(picks).toEqual({ 5: { lunch: { kind: 'restaurant', id } } });
    expect(applyChange(picks, { day: 5, meal: 'lunch', pick: { kind: 'restaurant', id } })).toBe(picks);
    expect(applyChange(picks, { day: 5, meal: 'lunch', pick: null })).toEqual({});
  });

  it('reads rows and delete keys, rejecting anything that is not a real slot', () => {
    expect(rowToChange({ plan_id: PLAN_ID, day: 3, meal: 'dinner', pick: { kind: 'restaurant', id } })).toEqual({
      day: 3,
      meal: 'dinner',
      pick: { kind: 'restaurant', id },
    });
    expect(rowToChange({ plan_id: PLAN_ID, day: 3, meal: 'dinner' })).toEqual({ day: 3, meal: 'dinner', pick: null });
    expect(rowToChange({ plan_id: 'other', day: 3, meal: 'dinner' })).toBeNull();
    expect(rowToChange({ day: 0, meal: 'dinner' })).toBeNull();
    expect(rowToChange({ day: 3, meal: 'brunch' })).toBeNull();
    expect(rowToChange(null)).toBeNull();
  });
});
