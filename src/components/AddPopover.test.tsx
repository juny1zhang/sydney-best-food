import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RESTAURANT_BY_ID } from '../data/restaurants';
import type { Restaurant } from '../data/types';
import { AddPopover } from './AddPopover';

const LEE_HO_FOOK = RESTAURANT_BY_ID.get('lee-ho-fook')!;

function popover(restaurant: Restaurant, extra: { onPickDay?: (day: number) => void } = {}) {
  render(
    <AddPopover
      id="pop"
      restaurant={restaurant}
      meal="dinner"
      onMeal={() => {}}
      freeDays={[21, 22, 28]}
      onPickDay={extra.onPickDay ?? (() => {})}
    />,
  );
  return screen.getByRole('region', { name: `把 ${restaurant.name} 加入日历` });
}

describe('add popover', () => {
  it('calls a closure the restaurant has announced what it is, not "maybe"', () => {
    // 22 December dinner is off; 28 December is shut all day.
    const pop = popover({ ...LEE_HO_FOOK, closed: [], closedDates: [28], closedMeals: { 22: ['dinner'] } });
    expect(within(pop).getByRole('button', { name: '12月22日 周二，已公布休息' })).toHaveTextContent('已公布休息');
    expect(within(pop).getByRole('button', { name: '12月28日 周一 · 补假日，已公布休息' })).toHaveClass('addpop__day--closed');
    expect(within(pop).getByRole('button', { name: '12月21日 周一' })).not.toHaveClass('addpop__day--closed');
    expect(within(pop).getByText('这家12月28日休息；12月22日晚餐不营业。')).toBeInTheDocument();
    expect(within(pop).queryByText(/可能休息/)).not.toBeInTheDocument();
  });

  it('still lists days the restaurant usually closes, but marks them', async () => {
    const user = userEvent.setup();
    const picked: number[] = [];
    // 21 and 28 December 2026 are Mondays; the 28th is also a public holiday.
    const pop = popover({ ...LEE_HO_FOOK, closed: [1] }, { onPickDay: (d) => picked.push(d) });

    const monday = within(pop).getByRole('button', { name: '12月21日 周一，可能休息' });
    expect(monday).toHaveClass('addpop__day--closed');
    expect(monday).toHaveTextContent('可能休息');
    expect(within(pop).getByRole('button', { name: '12月28日 周一 · 补假日，可能休息' })).toHaveClass('addpop__day--closed');

    const tuesday = within(pop).getByRole('button', { name: '12月22日 周二' });
    expect(tuesday).not.toHaveClass('addpop__day--closed');
    expect(tuesday).not.toHaveTextContent('可能休息');

    expect(within(pop).getByText('这家通常周一休息，标着“可能休息”的日子去之前先确认。')).toBeInTheDocument();

    await user.click(monday);
    expect(picked).toEqual([21]);
  });

  it('says nothing about closing days it does not know', () => {
    const pop = popover({ ...LEE_HO_FOOK, closed: undefined });
    expect(within(pop).getByRole('button', { name: '12月21日 周一' })).not.toHaveClass('addpop__day--closed');
    expect(within(pop).queryByText(/可能休息/)).not.toBeInTheDocument();
  });

  it('skips the closing note when none of the open days is affected', () => {
    // Closed on Sundays only; none of the listed days is a Sunday.
    const pop = popover({ ...LEE_HO_FOOK, closed: [0] });
    expect(within(pop).queryByText(/可能休息/)).not.toBeInTheDocument();
  });
});
