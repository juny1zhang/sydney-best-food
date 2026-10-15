import { render, screen } from '@testing-library/react';
import { NZ_TRIP_DAYS } from '../data/december';
import { RESTAURANT_BY_ID } from '../data/restaurants';
import { setPick, type Picks } from '../lib/plan';
import { Legend, MonthGrid, dayCellElement } from './Calendar';

const LEE_HO_FOOK = RESTAURANT_BY_ID.get('lee-ho-fook')!;

function grid(picks: Picks = {}) {
  render(<MonthGrid picks={picks} selected={3} onSelect={() => {}} />);
}

function cell(day: number): HTMLElement {
  return dayCellElement(day)!;
}

describe('month grid', () => {
  it('outlines every flight day on top of its own colour', () => {
    grid();
    expect(cell(2)).toHaveClass('cell--travel', 'cell--flight');
    expect(cell(6)).toHaveClass('cell--booked', 'cell--in-nz', 'cell--flight');
    expect(cell(9)).toHaveClass('cell--nz', 'cell--flight');
    expect(cell(20)).toHaveClass('cell--nz', 'cell--flight');
    for (const day of [3, 5, 7, 12, 19, 21]) expect(cell(day)).not.toHaveClass('cell--flight');
    // Flying out and back still counts as New Zealand days.
    expect(NZ_TRIP_DAYS).toBe(15);
  });

  it('names the flight in the day label', () => {
    grid();
    expect(cell(2)).toHaveAccessibleName('12月2日 周三，飞行日 北京 → 悉尼，未安排');
    expect(cell(6)).toHaveAccessibleName('12月6日 周日，新西兰 奥克兰，飞行日 06:25 悉尼 → 奥克兰，晚餐 Advieh（已预订 19:30）');
    expect(cell(9)).toHaveAccessibleName('12月9日 周三，新西兰 奥克兰 → 基督城，飞行日 19:40 奥克兰 → 基督城，未安排');
    expect(cell(20)).toHaveAccessibleName('12月20日 周日，新西兰 基督城 → 悉尼，飞行日 晚上 基督城 → 悉尼，未安排');
    expect(cell(7).getAttribute('aria-label')).not.toContain('飞行日');
  });

  it('keeps the flight outline once a flight day has a pick', () => {
    grid(setPick({}, 2, 'dinner', { kind: 'custom', name: '机场面馆', note: '' }));
    expect(cell(2)).toHaveClass('cell--picked', 'cell--flight');
    expect(cell(2)).toHaveAccessibleName('12月2日 周三，飞行日 北京 → 悉尼，晚餐 机场面馆（已选好）');
  });

  it('colours a pick marked as booked like a trip booking', () => {
    let picks = setPick({}, 22, 'dinner', { kind: 'restaurant', id: LEE_HO_FOOK.id, booked: true, time: '19:30' });
    picks = setPick(picks, 23, 'lunch', { kind: 'custom', name: '楼下面馆', note: '', booked: true });
    picks = setPick(picks, 24, 'lunch', { kind: 'restaurant', id: LEE_HO_FOOK.id });
    grid(picks);

    expect(cell(22)).toHaveClass('cell--booked');
    expect(cell(22)).toHaveAccessibleName(`12月22日 周二，悉尼，晚餐 ${LEE_HO_FOOK.name}（已预订 19:30）`);
    expect(cell(22).querySelector('.cell__meal-name .cell__check')).not.toBeNull();
    expect(cell(22).querySelector('.cell__mark--booked')).not.toBeNull();

    expect(cell(23)).toHaveClass('cell--booked');
    expect(cell(23)).toHaveAccessibleName('12月23日 周三，悉尼，午餐 楼下面馆（已预订）');

    // A plain pick still reads as picked.
    expect(cell(24)).toHaveClass('cell--picked');
    expect(cell(24).querySelector('.cell__check')).toBeNull();
    expect(cell(24).getAttribute('aria-label')).toContain('（已选好）');
  });

  it('marks the day booked when only one of its meals is booked', () => {
    let picks = setPick({}, 22, 'lunch', { kind: 'restaurant', id: LEE_HO_FOOK.id });
    picks = setPick(picks, 22, 'dinner', { kind: 'custom', name: '楼下面馆', note: '', booked: true, time: '18:00' });
    grid(picks);
    expect(cell(22)).toHaveClass('cell--booked');
    expect(cell(22)).toHaveAccessibleName(`12月22日 周二，悉尼，午餐 ${LEE_HO_FOOK.name}（已选好），晚餐 楼下面馆（已预订 18:00）`);
    expect(cell(22).querySelectorAll('.cell__meal-name .cell__check')).toHaveLength(1);
  });
});

describe('legend', () => {
  it('still explains the flight-day outline', () => {
    render(<Legend />);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['已预订', '已选好', '在新西兰', '飞行日']);
  });
});
