import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onTestFinished } from 'vitest';
import App from '../App';
import { loadDetails } from '../data/details';
import { RESTAURANT_BY_ID } from '../data/restaurants';
import type { Restaurant } from '../data/types';
import { RestaurantPage } from './RestaurantPage';

vi.mock('../data/details', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/details')>();
  return { ...actual, loadDetails: vi.fn(actual.loadDetails) };
});

/** Hours and closing days are researched separately; pin what a test needs and put the entry back afterwards. */
function pin(id: string, extra: Partial<Restaurant>) {
  const r = RESTAURANT_BY_ID.get(id)!;
  const before = { ...r };
  Object.assign(r, { hours: undefined, hoursSource: undefined, closed: undefined }, extra);
  onTestFinished(() => {
    for (const k of Object.keys(r)) delete r[k as keyof Restaurant];
    Object.assign(r, before);
  });
}

function renderPage(id: string) {
  return render(<RestaurantPage id={id} picks={{}} onAdd={vi.fn()} onClose={vi.fn()} />);
}

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
    const add = within(page).getByRole('button', { name: /加入日历/ });
    await user.click(add);
    await user.click(within(page).getByRole('button', { name: '12月4日 周五' }));
    expect(within(page).getByText('已在日历：12月4日 晚餐')).toBeInTheDocument();
    expect(screen.getByText('已选 1 餐')).toBeInTheDocument();
    // The popover goes away; focus comes back to the button that opened it.
    expect(add).toHaveAttribute('aria-expanded', 'false');
    expect(add).toHaveFocus();

    // The calendar is still mounted, hidden, under the page. Closing the toast must not send focus there.
    expect(screen.getByRole('button', { name: /^12月4日 周五.*晚餐 Lee Ho Fook Sydney/, hidden: true })).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: '关闭提示' }));
    expect(screen.queryByRole('button', { name: '关闭提示' })).not.toBeInTheDocument();
    expect(add).toHaveFocus();
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

  it('suggests the meal the place actually serves', async () => {
    const user = userEvent.setup();
    const pressedMeal = async (id: string) => {
      const { unmount } = renderPage(id);
      await user.click(screen.getByRole('button', { name: /加入日历/ }));
      const pressed = within(screen.getByRole('group', { name: '哪一餐' })).getByRole('button', { pressed: true });
      const label = pressed.textContent;
      unmount();
      return label;
    };
    expect(await pressedMeal('aria')).toBe('晚餐');
    expect(await pressedMeal('bills')).toBe('午餐');
    pin('bills', { meals: ['breakfast'] });
    expect(await pressedMeal('bills')).toBe('晚餐');
  });

  it('drops a dish photo and its credit when the photo fails to load', async () => {
    renderPage('lee-ho-fook');
    const img = await screen.findByRole('img', { name: '福建蟹肉带子炒饭' });
    const dish = img.closest('li')!;
    expect(within(dish).getByRole('link', { name: /^图片：/ })).toBeInTheDocument();

    fireEvent.error(img);
    expect(within(dish).queryByRole('img')).not.toBeInTheDocument();
    expect(within(dish).queryByRole('link', { name: /^图片：/ })).not.toBeInTheDocument();
    expect(within(dish).getByRole('heading', { name: '福建蟹肉带子炒饭' })).toBeInTheDocument();
  });

  it('drops gallery photos that fail to load, and the gallery once none are left', async () => {
    const { container } = renderPage('lee-ho-fook');
    await screen.findByRole('heading', { name: '招牌菜' });
    const figures = () => screen.queryAllByRole('figure');
    expect(figures()).toHaveLength(3);

    fireEvent.error(within(figures()[0]).getByRole('img'));
    expect(figures()).toHaveLength(2);
    expect(screen.queryByText('悉尼店用餐区，红墙拱窗的老仓库空间')).not.toBeInTheDocument();

    for (const f of figures()) fireEvent.error(within(f).getByRole('img'));
    expect(figures()).toHaveLength(0);
    expect(container.querySelector('.gallery')).toBeNull();
  });

  it('offers to retry when the menus fail to load', async () => {
    const user = userEvent.setup();
    const { loadDetails: realLoad } = await vi.importActual<typeof import('../data/details')>('../data/details');
    let finish = () => {};
    const load = vi.mocked(loadDetails);
    load.mockClear();
    load.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)).then(realLoad));

    renderPage('aria');
    expect(await screen.findByText('菜单没加载出来，检查一下网络再试一次。')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: '重试' });
    await user.click(retry);
    expect(retry).toHaveTextContent('加载中…');
    expect(retry).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('正在加载菜单…');
    await user.click(retry); // already on it
    expect(load).toHaveBeenCalledTimes(2);

    finish();
    expect(await screen.findByRole('heading', { name: '招牌菜' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /重试|加载中/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '菜单' })).toHaveFocus();
  });

  it('shows opening hours with where they were read', () => {
    pin('aria', { hours: '周二至周六晚餐，周五有午市', hoursSource: 'https://www.ariasydney.com.au/contact', closed: [0, 1] });
    renderPage('aria');
    expect(screen.getByText('营业时间：周二至周六晚餐，周五有午市')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '来源：ariasydney.com.au' })).toHaveAttribute('href', 'https://www.ariasydney.com.au/contact');
  });

  it('falls back to the closing days, and says nothing when nobody checked', () => {
    pin('aria', { closed: [0, 1] });
    const { container, unmount } = renderPage('aria');
    expect(screen.getByText('营业时间：周一、周日休息')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^来源：/ })).not.toBeInTheDocument();
    unmount();

    pin('aria', {});
    renderPage('aria');
    expect(screen.queryByText(/^营业时间：/)).not.toBeInTheDocument();
    expect(container.querySelector('.detail__hours')).toBeNull();
  });
});
