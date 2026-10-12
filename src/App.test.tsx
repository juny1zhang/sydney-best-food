import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY } from './lib/storage';

function dayButton(label: RegExp) {
  return screen.getByRole('button', { name: label });
}

function panel() {
  return screen.getByRole('complementary', { name: /12月/ });
}

describe('App', () => {
  it('opens on the overview with every category and the trip bookings counted', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: '悉尼餐厅榜单' })).toBeInTheDocument();
    for (const name of ['中餐', '日料', '韩餐', '东南亚', '现代澳洲', '海鲜', '早午餐 / 甜品']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText('已订 2 餐')).toBeInTheDocument();
    expect(screen.getByText('已选 0 餐')).toBeInTheDocument();
  });

  it('adds a restaurant from the list to a Sydney day', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^中餐/ }));
    const rows = screen.getByRole('list', { name: '中餐排名' });
    const firstRow = within(rows).getAllByRole('listitem')[0];
    expect(within(firstRow).getByRole('heading', { name: 'Lee Ho Fook Sydney' })).toBeInTheDocument();

    await user.click(within(firstRow).getByRole('button', { name: /加入日历/ }));
    const pop = screen.getByRole('region', { name: '把 Lee Ho Fook Sydney 加入日历' });
    // New Zealand days are never offered.
    expect(within(pop).queryByRole('button', { name: /12月6日/ })).not.toBeInTheDocument();
    await user.click(within(pop).getByRole('button', { name: '12月4日 周五' }));

    expect(screen.getByText('已把 Lee Ho Fook Sydney 加到 12月4日 周五 晚餐')).toBeInTheDocument();
    expect(dayButton(/^12月4日 周五.*晚餐 Lee Ho Fook Sydney/)).toBeInTheDocument();
    expect(screen.getByText('已选 1 餐')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ 4: { dinner: { kind: 'restaurant', id: 'lee-ho-fook' } } });
  });

  it('shows a booked New Zealand dinner with its category and intro', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayButton(/^12月6日 周日/));
    const p = panel();
    expect(within(p).getByRole('heading', { name: '12月6日 周日' })).toBeInTheDocument();
    expect(within(p).getByText('新西兰第 1 天 · 奥克兰')).toBeInTheDocument();
    expect(within(p).getByText('已预订 · 19:30')).toBeInTheDocument();
    expect(within(p).getByText('Advieh')).toBeInTheDocument();
    expect(within(p).getByText('中东风味')).toBeInTheDocument();
    expect(within(p).getByText(/Gareth Stewart/)).toBeInTheDocument();
  });

  it('picks from the calendar with search, swaps it, and deletes it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayButton(/^12月22日 周二/));
    const p = panel();
    await user.click(within(p).getByRole('button', { name: '午餐' }));
    await user.type(within(p).getByLabelText('搜索餐厅、菜系或区域'), '金沙');
    await user.click(within(p).getByRole('button', { name: '选这家：Golden Sands（午餐）' }));

    expect(dayButton(/^12月22日 周二.*午餐 Golden Sands（已选好）/)).toBeInTheDocument();
    expect(within(panel()).getByText('金沙酒楼 · Hurstville · $$')).toBeInTheDocument();

    // Swapping keeps the current pick until a new one is chosen.
    await user.click(within(panel()).getByRole('button', { name: '换一家：午餐' }));
    expect(within(panel()).getByText('给午餐换一家')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: '不换了' }));
    expect(dayButton(/^12月22日 周二.*午餐 Golden Sands/)).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: '换一家：午餐' }));
    await user.type(within(panel()).getByLabelText('搜索餐厅、菜系或区域'), 'gigi');
    expect(within(panel()).getByText('通常不做午餐')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: '选这家：Gigi’s Balmain（午餐）' }));
    expect(dayButton(/^12月22日 周二.*午餐 Gigi’s Balmain/)).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: '删除：午餐 Gigi’s Balmain' }));
    expect(dayButton(/^12月22日 周二.*未安排/)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{}');
  });

  it('never lets the custom form overwrite a meal filled from the list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayButton(/^12月3日 周四/));
    await user.click(within(panel()).getByRole('button', { name: '不在榜单里？手动添加一家' }));
    await user.type(within(panel()).getByLabelText('店名'), '楼下面馆');

    // Meanwhile dinner on the same day is filled from the board.
    await user.click(screen.getByRole('button', { name: /^中餐/ }));
    const firstRow = within(screen.getByRole('list', { name: '中餐排名' })).getAllByRole('listitem')[0];
    await user.click(within(firstRow).getByRole('button', { name: /加入日历/ }));
    await user.click(within(screen.getByRole('region', { name: /加入日历/ })).getByRole('button', { name: '12月3日 周四', exact: true } as never));

    // The open form now targets the meal that is still free, and says so.
    const form = within(panel()).getByRole('form', { name: '手动添加一家店' });
    expect(within(form).queryByRole('group', { name: '哪一餐' })).not.toBeInTheDocument();
    expect(form).toHaveTextContent('午餐');
    expect(within(form).getByLabelText('店名')).toHaveValue('楼下面馆');
    await user.click(within(form).getByRole('button', { name: '保存' }));
    expect(dayButton(/^12月3日 周四.*午餐 楼下面馆.*晚餐 Lee Ho Fook Sydney/)).toBeInTheDocument();
  });

  it('keeps counts honest when filtering by price', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '$', exact: true } as never));
    const japanese = screen.getByRole('article', { name: '日料' });
    expect(within(japanese).getByText('0 家 · 共 7 家')).toBeInTheDocument();
    expect(within(japanese).queryByRole('button', { name: /看全部/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^日料/ })).toHaveTextContent('0');
  });

  it('lets you note a local place for a New Zealand day', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayButton(/^12月14日 周一/));
    await user.click(within(panel()).getByRole('button', { name: '手动添加一家店' }));
    await user.click(within(panel()).getByRole('button', { name: '午餐' }));
    await user.type(within(panel()).getByLabelText('店名'), 'Fergburger');
    await user.click(within(panel()).getByRole('button', { name: '保存' }));
    expect(dayButton(/^12月14日 周一.*午餐 Fergburger/)).toBeInTheDocument();
  });

  it('restores saved picks after a reload', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 24: { dinner: { kind: 'restaurant', id: 'bennelong' } } }));
    render(<App />);
    expect(dayButton(/^12月24日 周四，平安夜.*晚餐 Bennelong/)).toBeInTheDocument();
    expect(screen.getByText('已选 1 餐')).toBeInTheDocument();
  });
});
