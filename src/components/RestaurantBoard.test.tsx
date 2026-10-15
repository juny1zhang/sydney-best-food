import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Meal, Restaurant } from '../data/types';
import { BOARD_KEYS, RestaurantBoard, useBoardCategory } from './RestaurantBoard';

type OnAdd = (r: Restaurant, day: number, meal: Meal) => void;

/** The board the way App wires it: category state lives outside, remembered by the same hook. */
function Board({ onAdd = () => {} }: { onAdd?: OnAdd }) {
  const [category, setCategory] = useBoardCategory();
  return <RestaurantBoard category={category} onCategory={setCategory} picks={{}} onAdd={onAdd} />;
}

const searchBox = () => screen.getByRole('searchbox', { name: '搜索榜单' });
const tab = (name: RegExp) => within(screen.getByRole('group', { name: '按类别查看' })).getByRole('button', { name });
const names = (listName: string) =>
  within(screen.getByRole('list', { name: listName }))
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);
const sortBox = () => screen.getByRole('combobox', { name: '排序' });

describe('board search', () => {
  it('turns the overview into one list across categories', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.type(searchBox(), 'halal');

    expect(screen.getByText('找到 2 家')).toHaveAttribute('aria-live', 'polite');
    expect(names('搜索结果')).toEqual(['Temu Kangen', 'Sahtein']);
    const results = screen.getByRole('list', { name: '搜索结果' });
    expect(within(results).getByText('东南亚 · 第 5 名')).toBeInTheDocument();
    expect(within(results).getByText('中东 / 地中海 · 第 7 名')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: '中餐' })).not.toBeInTheDocument();
    // Tab counts follow the search.
    expect(tab(/^全部/)).toHaveTextContent('2');
    expect(tab(/^东南亚/)).toHaveTextContent('1');
    expect(tab(/^中餐/)).toHaveTextContent('0');
  });

  it('keeps the price filter on search results', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.type(searchBox(), 'halal');
    await user.click(screen.getByRole('button', { name: '$', exact: true } as never));
    expect(screen.getByText('找到 1 家 · 只看 $')).toBeInTheDocument();
    expect(names('搜索结果 · $')).toEqual(['Temu Kangen']);

    await user.click(screen.getByRole('button', { name: '$$$$', exact: true } as never));
    expect(screen.getByText('没找到和“halal”相关的餐厅（$$$$）。')).toBeInTheDocument();
    expect(screen.getByText('没有相关的店 · 只看 $$$$')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看全部价位' }));
    expect(names('搜索结果')).toEqual(['Temu Kangen', 'Sahtein']);
    await waitFor(() => expect(screen.getByRole('button', { name: '全部价位' })).toHaveFocus());
  });

  it('narrows a category to what matches, without category labels', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(tab(/^中餐/));
    await user.type(searchBox(), '烤鸭');
    expect(screen.getByText('中餐里找到 3 家')).toBeInTheDocument();
    expect(names('中餐排名')).toEqual(['Lee Ho Fook Sydney', 'Grandfathers', 'Mr. Wong']);
    expect(screen.queryByText(/中餐 · 第/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '$$$', exact: true } as never));
    expect(screen.getByText('中餐里找到 2 家 · 只看 $$$')).toBeInTheDocument();
    expect(names('中餐排名 · $$$')).toEqual(['Grandfathers', 'Mr. Wong']);
  });

  it('says so when nothing matches, and offers a way out', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(tab(/^日料/));
    await user.type(searchBox(), 'halal');
    expect(screen.getByText('没找到和“halal”相关的日料。')).toBeInTheDocument();
    expect(screen.getByText('日料里没有相关的店')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '日料排名' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '看全部类别的 2 家' }));
    expect(tab(/^全部/)).toHaveAttribute('aria-pressed', 'true');
    expect(names('搜索结果')).toEqual(['Temu Kangen', 'Sahtein']);
    await waitFor(() => expect(tab(/^全部/)).toHaveFocus());

    await user.clear(searchBox());
    await user.type(searchBox(), 'zzzz');
    expect(screen.getByText('没找到和“zzzz”相关的餐厅。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /看全部类别/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(searchBox()).toHaveValue('');
    expect(searchBox()).toHaveFocus();
    expect(screen.getByRole('article', { name: '中餐' })).toBeInTheDocument();
  });

  it('clears with the × button or Escape', async () => {
    const user = userEvent.setup();
    render(<Board />);
    expect(screen.queryByRole('button', { name: '清空搜索框' })).not.toBeInTheDocument();
    await user.type(searchBox(), 'pizza');
    expect(screen.getByText('找到 2 家')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清空搜索框' }));
    expect(searchBox()).toHaveValue('');
    expect(searchBox()).toHaveFocus();
    expect(screen.queryByText('找到 2 家')).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: '中餐' })).toBeInTheDocument();

    await user.type(searchBox(), 'pizza{Escape}');
    expect(searchBox()).toHaveValue('');
    expect(screen.queryByRole('button', { name: '清空搜索框' })).not.toBeInTheDocument();
  });
});

describe('board sorting', () => {
  it('reorders a category list', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(tab(/^中餐/));
    expect(sortBox()).toHaveValue('rank');
    expect(names('中餐排名').slice(0, 3)).toEqual(['Lee Ho Fook Sydney', 'Grandfathers', 'Mr. Wong']);

    await user.selectOptions(sortBox(), '小红书口碑');
    expect(names('中餐排名').slice(0, 3)).toEqual(['The Chairman', 'Palace Chinese Restaurant', 'Cheng\'s Xi\'an Traditional Foods']);

    await user.selectOptions(sortBox(), 'TripAdvisor 评分');
    expect(names('中餐排名').slice(0, 5)).toEqual(['Mr. Wong', 'Spice Temple', 'Palace Chinese Restaurant', 'XOPP by Golden Century', 'Lee Ho Fook Sydney']);

    await user.selectOptions(sortBox(), '价格从低到高');
    expect(names('中餐排名').slice(0, 3)).toEqual(['Xi’an Eatery', 'Cheng\'s Xi\'an Traditional Foods', 'The Chairman']);
    // Each row keeps showing its own rank.
    expect(within(screen.getByRole('list', { name: '中餐排名' })).getAllByRole('listitem')[0]).toHaveTextContent(/^08/);

    await user.selectOptions(sortBox(), '价格从高到低');
    expect(names('中餐排名')[0]).toBe('Lee Ho Fook Sydney');
  });

  it('reorders search results but leaves the overview cards by rank', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.type(searchBox(), 'dumplings');
    expect(names('搜索结果').slice(0, 2)).toEqual(['Grandfathers', 'Sáng by Mabasa']);
    await user.selectOptions(sortBox(), '小红书口碑');
    expect(names('搜索结果').slice(0, 4)).toEqual(['Sáng by Mabasa', 'Palace Chinese Restaurant', 'Cheng\'s Xi\'an Traditional Foods', 'Grandfathers']);

    await user.selectOptions(sortBox(), '价格从低到高');
    await user.clear(searchBox());
    const chinese = screen.getByRole('article', { name: '中餐' });
    expect(within(chinese).getAllByRole('link').map((a) => a.textContent)).toEqual(['Lee Ho Fook Sydney', 'Grandfathers', 'Mr. Wong']);
    expect(screen.queryByRole('combobox', { name: '排序' })).not.toBeInTheDocument();
  });
});

describe('board memory', () => {
  it('remembers the category, price and sort across a reload, but not the search', async () => {
    const user = userEvent.setup();
    const first = render(<Board />);
    await user.click(tab(/^中餐/));
    await user.click(screen.getByRole('button', { name: '$$', exact: true } as never));
    await user.selectOptions(sortBox(), '小红书口碑');
    await user.type(searchBox(), 'duck');
    first.unmount();

    render(<Board />);
    expect(tab(/^中餐/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '$$', exact: true } as never)).toHaveAttribute('aria-pressed', 'true');
    expect(sortBox()).toHaveValue('xhs');
    expect(searchBox()).toHaveValue('');
    expect(names('中餐排名 · $$')).toEqual(['The Chairman', 'Palace Chinese Restaurant']);
  });

  it('falls back to the defaults when what was stored makes no sense', async () => {
    const user = userEvent.setup();
    localStorage.setItem(BOARD_KEYS.category, 'pasta-bars');
    localStorage.setItem(BOARD_KEYS.price, '$$$$$');
    localStorage.setItem(BOARD_KEYS.sort, '{"by":"rank"}');
    render(<Board />);
    expect(tab(/^全部/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '全部价位' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('article', { name: '中餐' })).toBeInTheDocument();
    await user.click(tab(/^中餐/));
    expect(sortBox()).toHaveValue('rank');
    expect(localStorage.getItem(BOARD_KEYS.category)).toBe('chinese');
    expect(localStorage.getItem(BOARD_KEYS.price)).toBe('all');
    expect(localStorage.getItem(BOARD_KEYS.sort)).toBe('rank');
  });
});

describe('board list', () => {
  it('says what the expand button controls and whether it is open', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(tab(/^中餐/));
    const list = screen.getByRole('list', { name: '中餐排名' });
    const more = screen.getByRole('button', { name: '展开其余 3 家' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', list.id);
    expect(names('中餐排名')).toHaveLength(6);

    await user.click(more);
    expect(screen.getByRole('button', { name: '收起' })).toHaveAttribute('aria-expanded', 'true');
    expect(names('中餐排名')).toHaveLength(9);
  });

  it('offers a meal the place actually serves when adding it', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<OnAdd>();
    render(<Board onAdd={onAdd} />);
    const mealButton = (place: string, meal: string) =>
      within(within(screen.getByRole('region', { name: `把 ${place} 加入日历` })).getByRole('group', { name: '哪一餐' })).getByRole('button', {
        name: meal,
      });

    await user.click(tab(/^早午餐/));
    const lune = within(screen.getByRole('list', { name: '早午餐 / 甜品排名' })).getAllByRole('listitem')[0];
    await user.click(within(lune).getByRole('button', { name: /加入日历/ }));
    expect(mealButton('Lune Croissanterie', '午餐')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/这家通常不做/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '12月4日 周五' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'lune' }), 4, 'lunch');

    // Lunch still suits a place that does both; a dinner-only pizzeria switches back.
    await user.click(tab(/^意大利/));
    const rows = within(screen.getByRole('list', { name: '意大利 / 披萨排名' })).getAllByRole('heading', { level: 3 });
    expect(rows[0]).toHaveTextContent('Gigi’s Balmain');
    await user.click(screen.getAllByRole('button', { name: /加入日历/ })[1]);
    expect(mealButton('Beppi’s', '午餐')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getAllByRole('button', { name: /加入日历/ })[0]);
    expect(mealButton('Gigi’s Balmain', '晚餐')).toHaveAttribute('aria-pressed', 'true');
  });

  it("doesn't let a café's lunch carry over to the next place when nothing was added", async () => {
    const user = userEvent.setup();
    render(<Board onAdd={vi.fn<OnAdd>()} />);
    const pressed = (place: string) =>
      within(within(screen.getByRole('region', { name: `把 ${place} 加入日历` })).getByRole('group', { name: '哪一餐' })).getByRole('button', {
        pressed: true,
      });

    await user.click(tab(/^早午餐/));
    const add = () => within(screen.getByRole('list', { name: '早午餐 / 甜品排名' })).getAllByRole('button', { name: /加入日历/ });
    await user.click(add()[0]);
    expect(pressed('Lune Croissanterie')).toHaveTextContent('午餐');
    await user.click(add()[0]);

    await user.click(tab(/^意大利/));
    await user.click(screen.getAllByRole('button', { name: /加入日历/ })[1]);
    expect(pressed('Beppi’s')).toHaveTextContent('晚餐');
  });
});
