import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RESTAURANT_BY_ID } from '../data/restaurants';
import type { Restaurant } from '../data/types';
import { AddPopover } from './AddPopover';

const LEE_HO_FOOK = RESTAURANT_BY_ID.get('lee-ho-fook')!;

function popover(restaurant: Restaurant, extra: { placements?: string[]; onPickDay?: (day: number) => void } = {}) {
  render(
    <AddPopover
      id="pop"
      restaurant={restaurant}
      meal="dinner"
      onMeal={() => {}}
      freeDays={[21, 22, 28]}
      onPickDay={extra.onPickDay ?? (() => {})}
      placements={extra.placements}
    />,
  );
  return screen.getByRole('region', { name: `把 ${restaurant.name} 加入日历` });
}

describe('add popover', () => {
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

  it('shows where the restaurant already sits on the calendar', () => {
    const pop = popover(LEE_HO_FOOK, { placements: ['12月4日 晚餐', '12月21日 午餐'] });
    expect(within(pop).getByText('已在日历：12月4日 晚餐、12月21日 午餐')).toBeInTheDocument();
  });

  it('leaves the placement line out when the restaurant is not on the calendar', () => {
    const pop = popover(LEE_HO_FOOK, { placements: [] });
    expect(within(pop).queryByText(/已在日历/)).not.toBeInTheDocument();
    cleanup();
    // Callers that do not pass placements at all.
    const again = popover(LEE_HO_FOOK);
    expect(within(again).queryByText(/已在日历/)).not.toBeInTheDocument();
  });
});
