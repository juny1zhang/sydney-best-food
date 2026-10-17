import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { WISHLIST_KEY } from '../lib/storage';

describe('restaurant page', () => {
  it('opens from the list and comes back to the same category', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^日料/ }));
    await user.click(screen.getByRole('link', { name: 'Kisuke' }));

    const page = await screen.findByRole('main', { name: 'Kisuke' });
    expect(within(page).getByRole('heading', { level: 1, name: 'Kisuke' })).toHaveFocus();
    expect(within(page).getByRole('heading', { level: 2, name: '菜单' })).toBeInTheDocument();
    // Menus load separately from the first page.
    const dishes = await within(page).findByRole('heading', { level: 2, name: '招牌菜' });
    expect(within(dishes.parentElement!).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole('heading', { name: '悉尼餐厅榜单' })).not.toBeInTheDocument();
    expect(document.title).toBe('Kisuke · 悉尼吃什么');

    await user.click(within(page).getByRole('button', { name: '返回' }));
    await waitFor(() => expect(screen.queryByRole('main', { name: 'Kisuke' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^日料/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Kisuke' })).toHaveFocus();
  });

  it('puts the restaurant on the calendar from its own page', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#r/lee-ho-fook');
    render(<App />);
    const page = screen.getByRole('main', { name: 'Lee Ho Fook Sydney' });
    await user.click(within(page).getByRole('button', { name: /加入日历/ }));
    await user.click(within(page).getByRole('button', { name: '12月4日 周五' }));
    expect(within(page).getByText('已在日历：12月4日 晚餐')).toBeInTheDocument();
    expect(screen.getByText('已选 1 餐')).toBeInTheDocument();
  });

  it('saves the restaurant to 想去 from its own page', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#r/kisuke');
    render(<App />);
    const page = screen.getByRole('main', { name: 'Kisuke' });
    const wish = within(page).getByRole('button', { name: '想去：Kisuke' });
    expect(wish).toHaveAttribute('aria-pressed', 'false');
    await user.click(wish);
    expect(wish).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(WISHLIST_KEY)!)).toEqual(['kisuke']);
  });

  it('sends a link opened directly back to the list', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/#r/aria');
    render(<App />);
    await user.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(window.location.hash).toBe('#list'));
    expect(screen.getByRole('heading', { level: 1, name: '悉尼餐厅榜单' })).toBeVisible();
  });

  it('ignores links to restaurants that no longer exist', () => {
    window.history.replaceState(null, '', '/#r/dosa-hut');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: '悉尼餐厅榜单' })).toBeInTheDocument();
  });
});
