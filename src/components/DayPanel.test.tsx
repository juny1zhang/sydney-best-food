import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DAYS_IN_MONTH } from '../data/december';
import { RESTAURANT_BY_ID } from '../data/restaurants';
import type { Restaurant } from '../data/types';
import { countMeals, removePick, setPick, type Picks } from '../lib/plan';
import { MonthGrid, dayCellElement } from './Calendar';
import { DayPanel } from './DayPanel';
import type { BoardCategory } from './RestaurantBoard';

const LEE_HO_FOOK = RESTAURANT_BY_ID.get('lee-ho-fook')!;

/** The calendar and one day's panel, wired to picks the way the app does it. */
function Plan({ day, initial = {}, category = 'all' }: { day: number; initial?: Picks; category?: BoardCategory }) {
  const [picks, setPicks] = useState<Picks>(initial);
  const { booked, picked } = countMeals(picks, DAYS_IN_MONTH);
  return (
    <>
      <p data-testid="summary">{`已订 ${booked} 餐，已选 ${picked} 餐`}</p>
      <MonthGrid picks={picks} selected={day} onSelect={() => {}} />
      <aside aria-labelledby="day-h">
        <DayPanel
          day={day}
          picks={picks}
          boardCategory={category}
          titleId="day-h"
          onChoose={(d, m, p) => setPicks((x) => setPick(x, d, m, p))}
          onClear={(d, m) => setPicks((x) => removePick(x, d, m))}
        />
      </aside>
    </>
  );
}

function panel() {
  return screen.getByRole('complementary');
}

function summary() {
  return screen.getByTestId('summary').textContent;
}

/** Restaurant names in the picker, top to bottom. */
function pickerNames(): string[] {
  return within(panel())
    .getAllByRole('listitem')
    .map((li) => li.querySelector('.picker__name')!.textContent!);
}

let restore = () => {};

/**
 * Pretends some restaurants usually close on some weekdays, until the test ends. Every researched
 * closing day is set aside meanwhile, so the tests don't move when the data does.
 */
function closeOn(closed: Record<string, number[]>) {
  const all = [...RESTAURANT_BY_ID.values()];
  const saved = all.map((r: Restaurant) => ({ r, closed: r.closed, closedDates: r.closedDates, closedMeals: r.closedMeals }));
  for (const r of all) {
    delete r.closed;
    delete r.closedDates;
    delete r.closedMeals;
  }
  for (const [id, days] of Object.entries(closed)) RESTAURANT_BY_ID.get(id)!.closed = days;
  restore = () => {
    for (const { r, closed: c, closedDates: d, closedMeals: m } of saved) {
      if (c === undefined) delete r.closed;
      else r.closed = c;
      if (d === undefined) delete r.closedDates;
      else r.closedDates = d;
      if (m === undefined) delete r.closedMeals;
      else r.closedMeals = m;
    }
  };
}

afterEach(() => {
  restore();
  restore = () => {};
});

/** The researched closing days, to check every test puts them back. */
const RESEARCHED = JSON.stringify([...RESTAURANT_BY_ID.values()].map((r) => [r.id, r.closed, r.closedDates, r.closedMeals]));

describe('marking picks as booked', () => {
  it('keeps the booking when "换一家" ends on the same place', async () => {
    const user = userEvent.setup();
    const booked = { kind: 'restaurant' as const, id: LEE_HO_FOOK.id, booked: true, time: '19:30' };
    render(<Plan day={22} category="chinese" initial={{ 22: { dinner: booked } }} />);
    await user.click(within(panel()).getByRole('button', { name: '换一家：晚餐' }));
    await user.click(within(panel()).getByRole('button', { name: `选这家：${LEE_HO_FOOK.name}（晚餐）` }));
    expect(within(panel()).getByText('已预订 · 19:30')).toBeInTheDocument();
    expect(summary()).toBe('已订 3 餐，已选 0 餐');
  });

  it('books a picked restaurant at a time and takes the booking off again', async () => {
    const user = userEvent.setup();
    render(<Plan day={22} initial={{ 22: { dinner: { kind: 'restaurant', id: LEE_HO_FOOK.id } } }} />);
    expect(summary()).toBe('已订 2 餐，已选 1 餐');
    expect(dayCellElement(22)).toHaveClass('cell--picked');

    await user.click(within(panel()).getByRole('button', { name: `标记为已订：晚餐 ${LEE_HO_FOOK.name}` }));
    const form = within(panel()).getByRole('form', { name: `标记为已订：晚餐 ${LEE_HO_FOOK.name}` });
    const time = within(form).getByLabelText('订位时间（可选）');
    expect(time).toHaveFocus();
    // Changing or deleting the pick waits until the form is done.
    expect(within(panel()).queryByRole('button', { name: '换一家：晚餐' })).not.toBeInTheDocument();
    await user.type(time, '19:30');
    await user.click(within(form).getByRole('button', { name: '确定' }));

    expect(within(panel()).getByText('已预订 · 19:30')).toHaveClass('pill--booked');
    expect(dayCellElement(22)).toHaveClass('cell--booked');
    expect(dayCellElement(22)).toHaveAccessibleName(`12月22日 周二，悉尼，晚餐 ${LEE_HO_FOOK.name}（已预订 19:30）`);
    expect(summary()).toBe('已订 3 餐，已选 0 餐');
    await waitFor(() => expect(screen.getByRole('heading', { name: '12月22日 周二' })).toHaveFocus());
    expect(within(panel()).getByRole('button', { name: '换一家：晚餐' })).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: `删除：晚餐 ${LEE_HO_FOOK.name}` })).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: `取消已订：晚餐 ${LEE_HO_FOOK.name}` }));
    expect(within(panel()).getByText('已选好')).toHaveClass('pill--picked');
    expect(within(panel()).queryByText(/已预订/)).not.toBeInTheDocument();
    expect(dayCellElement(22)).toHaveClass('cell--picked');
    expect(dayCellElement(22)).toHaveAccessibleName(`12月22日 周二，悉尼，晚餐 ${LEE_HO_FOOK.name}（已选好）`);
    expect(summary()).toBe('已订 2 餐，已选 1 餐');
    await waitFor(() => expect(screen.getByRole('heading', { name: '12月22日 周二' })).toHaveFocus());
    expect(within(panel()).getByRole('button', { name: `标记为已订：晚餐 ${LEE_HO_FOOK.name}` })).toBeInTheDocument();
  });

  it('books a place typed in by hand, with no time, after a change of mind', async () => {
    const user = userEvent.setup();
    render(<Plan day={23} initial={{ 23: { lunch: { kind: 'custom', name: '楼下面馆', note: '' } } }} />);

    await user.click(within(panel()).getByRole('button', { name: '标记为已订：午餐 楼下面馆' }));
    await user.click(within(panel()).getByRole('button', { name: '取消' }));
    expect(within(panel()).queryByRole('form')).not.toBeInTheDocument();
    expect(summary()).toBe('已订 2 餐，已选 1 餐');
    await waitFor(() => expect(screen.getByRole('heading', { name: '12月23日 周三' })).toHaveFocus());

    await user.click(within(panel()).getByRole('button', { name: '标记为已订：午餐 楼下面馆' }));
    await user.click(within(panel()).getByRole('button', { name: '确定' }));
    expect(within(panel()).getByText('已预订')).toHaveClass('pill--booked');
    expect(dayCellElement(23)).toHaveClass('cell--booked');
    expect(dayCellElement(23)).toHaveAccessibleName('12月23日 周三，悉尼，午餐 楼下面馆（已预订）');
    expect(summary()).toBe('已订 3 餐，已选 0 餐');
    expect(within(panel()).getByRole('button', { name: '删除午餐 楼下面馆' })).toBeInTheDocument();
  });

  it('starts a replacement unbooked', async () => {
    const user = userEvent.setup();
    render(<Plan day={22} initial={{ 22: { dinner: { kind: 'restaurant', id: LEE_HO_FOOK.id, booked: true, time: '19:30' } } }} />);
    expect(summary()).toBe('已订 3 餐，已选 0 餐');

    await user.click(within(panel()).getByRole('button', { name: '换一家：晚餐' }));
    expect(within(panel()).getByText('正在换')).toBeInTheDocument();
    await user.type(within(panel()).getByLabelText('搜索餐厅、菜系或区域'), 'gigi');
    await user.click(within(panel()).getByRole('button', { name: '选这家：Gigi’s Balmain（晚餐）' }));

    expect(within(panel()).getByText('已选好')).toBeInTheDocument();
    expect(dayCellElement(22)).toHaveClass('cell--picked');
    expect(dayCellElement(22)).toHaveAccessibleName('12月22日 周二，悉尼，晚餐 Gigi’s Balmain（已选好）');
    expect(summary()).toBe('已订 2 餐，已选 1 餐');
  });

  it('leaves the trip bookings read-only', () => {
    render(<Plan day={6} />);
    expect(within(panel()).getByText('已预订 · 19:30')).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: /已订/ })).not.toBeInTheDocument();
  });
});

describe('flight days', () => {
  it('shows the flight under the date, apart from the plan', () => {
    render(<Plan day={6} />);
    const flight = within(panel()).getByRole('img', { name: '航班' }).closest('p')!;
    expect(flight).toHaveTextContent('06:25 悉尼 → 奥克兰');
    expect(within(panel()).getByText('12:30 奥克兰机场取车 · 入住 InterContinental')).toBeInTheDocument();
    expect(within(panel()).getByText('新西兰第 1 天 · 奥克兰')).toBeInTheDocument();
  });

  it.each([
    [9, '19:40 奥克兰 → 基督城', '17:00 奥克兰机场还车'],
    [20, '晚上 基督城 → 悉尼', '16:00 基督城机场还车'],
  ])('shows the flight on 12月%i日 too', (day, flight, plan) => {
    render(<Plan day={day} />);
    expect(within(panel()).getByRole('img', { name: '航班' }).closest('p')).toHaveTextContent(flight);
    expect(within(panel()).getByText(plan)).toBeInTheDocument();
  });

  it('names the route once on the day flying in from Beijing', () => {
    render(<Plan day={2} />);
    expect(within(panel()).getByText('飞行日')).toBeInTheDocument();
    expect(within(panel()).getByRole('img', { name: '航班' }).closest('p')).toHaveTextContent('北京 → 悉尼');
    expect(within(panel()).getByText('国航航班，从北京飞回悉尼')).toBeInTheDocument();
  });

  it('shows no flight on a day without one', () => {
    render(<Plan day={7} />);
    expect(within(panel()).queryByRole('img', { name: '航班' })).not.toBeInTheDocument();
  });
});

describe('closing days', () => {
  it('puts restaurants usually closed that day last, after the meal ordering', async () => {
    const user = userEvent.setup();
    // 21 December 2026 is a Monday. Gigi's and Al Taglio don't do lunch.
    closeOn({ gigis: [1], beppis: [1, 2] });
    render(<Plan day={21} category="italian" />);
    await user.click(within(panel()).getByRole('button', { name: '午餐' }));
    await user.click(within(panel()).getByRole('button', { name: '显示全部 7 家' }));

    expect(pickerNames()).toEqual([
      'Cibaria Manly',
      'OTTO Sydney',
      'Pellegrino 2000',
      'Fratelli Paradiso',
      'Al Taglio',
      'Beppi’s',
      'Gigi’s Balmain',
    ]);
    expect(within(panel()).getByText('意大利 / 披萨榜单 7 家，周一营业、做午餐的排在前面')).toBeInTheDocument();
    const items = within(panel()).getAllByRole('listitem');
    expect(within(items[5]).getByText('周一通常休息')).toBeInTheDocument();
    expect(within(items[6]).getByText('周一通常休息')).toBeInTheDocument();
    expect(within(items[6]).getByText('通常不做午餐')).toBeInTheDocument();
    expect(within(items[0]).queryByText(/休息/)).not.toBeInTheDocument();
  });

  it('keeps the usual order on a day they are open', () => {
    closeOn({ 'lee-ho-fook': [1] });
    render(<Plan day={22} category="chinese" />);
    expect(pickerNames()[0]).toBe(LEE_HO_FOOK.name);
    expect(within(panel()).queryByText(/通常休息/)).not.toBeInTheDocument();
    expect(within(panel()).getByText(/^中餐榜单 9 家，做晚餐的排在前面/)).toBeInTheDocument();
  });

  it('warns about a pick on a day it usually closes', () => {
    closeOn({ 'lee-ho-fook': [1] });
    render(<Plan day={21} initial={{ 21: { dinner: { kind: 'restaurant', id: LEE_HO_FOOK.id } } }} />);
    expect(within(panel()).getByText('提示：这家通常周一休息，去之前确认一下。')).toBeInTheDocument();
  });

  it('says nothing on a day the pick is open', () => {
    closeOn({ 'lee-ho-fook': [1] });
    render(<Plan day={22} initial={{ 22: { dinner: { kind: 'restaurant', id: LEE_HO_FOOK.id } } }} />);
    expect(within(panel()).queryByText(/休息/)).not.toBeInTheDocument();
  });

  it('warns about a date the restaurant has announced it is closed', async () => {
    const user = userEvent.setup();
    closeOn({});
    RESTAURANT_BY_ID.get('lee-ho-fook')!.closedDates = [25];
    render(<Plan day={25} category="chinese" initial={{ 25: { lunch: { kind: 'restaurant', id: LEE_HO_FOOK.id } } }} />);
    expect(within(panel()).getByText('提示：这家已公布12月25日休息，换一家吧。')).toBeInTheDocument();
    expect(within(panel()).getByText(/^中餐榜单 9 家，当天营业、做晚餐的排在前面/)).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: '显示全部 9 家' }));
    const names = pickerNames();
    expect(names[names.length - 1]).toBe(LEE_HO_FOOK.name);
    const items = within(panel()).getAllByRole('listitem');
    expect(within(items[items.length - 1]).getByText('12月25日休息')).toBeInTheDocument();
  });

  it('warns about a meal the restaurant has announced it will skip, and only that meal', () => {
    closeOn({});
    RESTAURANT_BY_ID.get('lee-ho-fook')!.closedMeals = { 24: ['dinner'] };
    render(
      <Plan
        day={24}
        initial={{ 24: { lunch: { kind: 'restaurant', id: LEE_HO_FOOK.id }, dinner: { kind: 'restaurant', id: LEE_HO_FOOK.id } } }}
      />,
    );
    expect(within(panel()).getAllByText(/^提示：这家已公布/)).toHaveLength(1);
    expect(within(panel()).getByText('提示：这家已公布12月24日晚餐不营业，换一家吧。')).toBeInTheDocument();
  });

  it('restores the data between tests', () => {
    expect(JSON.stringify([...RESTAURANT_BY_ID.values()].map((r) => [r.id, r.closed, r.closedDates, r.closedMeals]))).toBe(RESEARCHED);
  });
});

describe('restaurants already on the calendar', () => {
  it('says where in the picker', () => {
    render(<Plan day={22} category="chinese" initial={{ 4: { dinner: { kind: 'restaurant', id: LEE_HO_FOOK.id } }, 21: { lunch: { kind: 'restaurant', id: LEE_HO_FOOK.id } } }} />);
    const [first, second] = within(panel()).getAllByRole('listitem');
    expect(within(first).getByText('已在日历：12月4日 晚餐、12月21日 午餐')).toBeInTheDocument();
    expect(within(second).queryByText(/已在日历/)).not.toBeInTheDocument();
  });
});
