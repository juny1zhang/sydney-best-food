import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { STORAGE_KEY, WISHLIST_KEY } from './lib/storage';

function dayButton(label: RegExp) {
  return screen.getByRole('button', { name: label });
}

function panel() {
  return screen.getByRole('complementary', { name: /12月/ });
}

/** jsdom's Blob has no text(), so read it the old way. */
function readBlob(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(b);
  });
}

describe('App', () => {
  it('opens on a collapsed overview and counts the trip bookings', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: '悉尼餐厅榜单' })).toBeInTheDocument();
    for (const name of ['中餐', '火锅', '烤肉']) expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: '日料' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /印度/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开其余 10 个类别' }));
    for (const name of ['日料', '东南亚', '中东 / 地中海', '现代澳洲', '海鲜', '早午餐 / 甜品']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '收起' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('已订 2 餐')).toBeInTheDocument();
    expect(screen.getByText('已选 0 餐')).toBeInTheDocument();
  });

  it('adds a restaurant from the list to a Sydney day', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^中餐/ }));
    const rows = screen.getByRole('list', { name: /^中餐排名/ });
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
    await user.type(within(p).getByLabelText('搜索餐厅、菜系或区域'), '舌尖记忆');
    await user.click(within(p).getByRole('button', { name: '选这家：Memory Tongue Hotpot（午餐）' }));

    expect(dayButton(/^12月22日 周二.*午餐 Memory Tongue Hotpot（已选好，未订位）/)).toBeInTheDocument();
    expect(within(panel()).getByText('舌尖记忆 · Chatswood · $$')).toBeInTheDocument();

    // Swapping keeps the current pick until a new one is chosen.
    await user.click(within(panel()).getByRole('button', { name: '换一家：午餐' }));
    expect(within(panel()).getByText('给午餐换一家')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: '不换了' }));
    expect(dayButton(/^12月22日 周二.*午餐 Memory Tongue Hotpot/)).toBeInTheDocument();

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
    const firstRow = within(screen.getByRole('list', { name: /^中餐排名/ })).getAllByRole('listitem')[0];
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
    await user.click(screen.getByRole('button', { name: /^展开其余/ }));
    const japanese = screen.getByRole('article', { name: '日料' });
    expect(within(japanese).getByText('0 家 · 共 7 家')).toBeInTheDocument();
    expect(within(japanese).queryByRole('button', { name: /看全部/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^日料/ })).toHaveTextContent('0');
  });

  it('suggests places along the New Zealand route for each meal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayButton(/^12月18日 周五/));
    expect(within(panel()).getByText('当地推荐')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: '晚餐' }));
    expect(within(panel()).getByText(/^奥马鲁的推荐 \d+ 家/)).toBeInTheDocument();
    const choices = within(panel()).getAllByRole('button', { name: /^选这家：/ });
    expect(choices[0]).toHaveAccessibleName('选这家：Cucina（晚餐）');

    await user.click(choices[0]);
    expect(dayButton(/^12月18日 周五.*晚餐 Cucina（已选好，未订位）/)).toHaveClass('cell--picked');
    expect(within(panel()).getByText('阿根廷·地中海融合菜')).toBeInTheDocument();
    expect(within(panel()).getByText(/奥马鲁屡获大奖的餐厅/)).toBeInTheDocument();
    expect(within(panel()).getByText('评价依据（6）')).toBeInTheDocument();
  });

  it('lets you note a local place for a New Zealand day', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayButton(/^12月14日 周一/));
    await user.click(within(panel()).getByRole('button', { name: '不在推荐里？手动添加一家' }));
    await user.click(within(panel()).getByRole('button', { name: '午餐' }));
    await user.type(within(panel()).getByLabelText('店名'), '朋友推荐的小馆');
    await user.click(within(panel()).getByRole('button', { name: '保存' }));
    expect(dayButton(/^12月14日 周一.*午餐 朋友推荐的小馆/)).toBeInTheDocument();
  });

  it('restores saved picks after a reload', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 24: { dinner: { kind: 'restaurant', id: 'bennelong' } } }));
    render(<App />);
    expect(dayButton(/^12月24日 周四，平安夜.*晚餐 Bennelong/)).toBeInTheDocument();
    expect(screen.getByText('已选 1 餐')).toBeInTheDocument();
  });

  it('marks a pick as reserved and turns the day orange', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 4: { dinner: { kind: 'restaurant', id: 'lee-ho-fook' } } }));
    render(<App />);
    await user.click(dayButton(/^12月4日 周五/));
    await user.click(within(panel()).getByRole('button', { name: '标记已订位：晚餐' }));
    const form = within(panel()).getByRole('form', { name: '晚餐订位信息' });
    const time = within(form).getByLabelText('订到几点');
    expect(time).toHaveValue('19:00');
    await user.clear(time);
    await user.type(time, '19:15');
    await user.type(within(form).getByLabelText('备注（可选）'), '2 位');
    await user.click(within(form).getByRole('button', { name: '保存' }));

    expect(dayButton(/^12月4日 周五.*晚餐 Lee Ho Fook Sydney（已预订 19:15）/)).toHaveClass('cell--booked');
    expect(within(panel()).getByText('已预订 · 19:15')).toBeInTheDocument();
    expect(within(panel()).getByText('订位备注：2 位')).toBeInTheDocument();
    expect(screen.getByText('已订 3 餐')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: '取消已订：晚餐' }));
    expect(dayButton(/^12月4日 周五.*（已选好，未订位）/)).toHaveClass('cell--picked');
  });

  it('saves places to 想去 and puts them first when picking', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^日料/ }));
    const toggle = screen.getByRole('button', { name: '想去：Kisuke' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem(WISHLIST_KEY)!)).toEqual(['kisuke']);

    await user.click(screen.getByRole('button', { name: /^想去\s*1$/ }));
    const list = screen.getByRole('list', { name: /^想去的店/ });
    expect(within(list).getByRole('heading', { name: 'Kisuke' })).toBeInTheDocument();
    expect(within(list).getByText('日料第 2 名')).toBeInTheDocument();

    await user.click(dayButton(/^12月21日 周一/));
    const first = within(panel()).getAllByRole('listitem')[0];
    expect(first).toHaveTextContent('想去');
    expect(first).toHaveTextContent('Kisuke');
  });

  it('keeps focus in the 想去 list while un-saving places', async () => {
    const user = userEvent.setup();
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(['kisuke', 'mr-wong']));
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^想去\s*2$/ }));
    await user.click(screen.getByRole('button', { name: '想去：Kisuke' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '想去：Mr. Wong' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: '想去：Mr. Wong' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^想去\s*0$/ })).toHaveFocus());
    expect(screen.getByText(/还没有想去的店/)).toBeInTheDocument();
  });

  it('searches the whole board', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole('searchbox', { name: '搜索榜单' }), 'pizza');
    const list = screen.getByRole('list', { name: /^搜索“pizza”/ });
    expect(within(list).getByRole('heading', { name: 'Gigi’s Balmain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^全部\s*\d+$/ })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(screen.getByRole('heading', { level: 2, name: '中餐' })).toBeInTheDocument();
  });

  it('lists the whole plan and opens a day from it', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ 22: { lunch: { kind: 'restaurant', id: 'memory-tongue', reserved: { time: '11:30', note: '' } } } }),
    );
    render(<App />);
    const plan = screen.getByRole('region', { name: '十二月计划总览' });
    expect(within(plan).getByText('共 3 餐：')).toBeInTheDocument();
    const days = within(plan).getAllByRole('listitem').filter((li) => li.classList.contains('plan__day'));
    expect(days.map((d) => d.querySelector('.plan__date-main')?.textContent)).toEqual(['12月6日 周日', '12月12日 周六', '12月22日 周二']);
    expect(within(days[2]).getByText('已预订 · 11:30')).toBeInTheDocument();

    await user.click(within(plan).getByRole('button', { name: '打开这天：12月22日 周二' }));
    expect(within(panel()).getByRole('heading', { name: '12月22日 周二' })).toBeInTheDocument();
  });

  it('offers sharing only when the plan is shared live', () => {
    render(<App />);
    // Tests run without the shared backend, so the plan lives on this device only.
    expect(screen.queryByRole('button', { name: '分享给家人' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出到手机日历' })).toBeEnabled();
  });

  it('exports the plan as a calendar file', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:plan';
    });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);
    await user.click(screen.getByRole('button', { name: '导出到手机日历' }));
    expect(click).toHaveBeenCalled();
    expect(blobs[0].type).toBe('text/calendar;charset=utf-8');
    expect(await readBlob(blobs[0])).toContain('SUMMARY:晚餐 · Kika');
    expect(screen.getByText('已生成日历文件（2 餐），打开它就能加进手机或电脑的日历')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭提示' }));
    expect(screen.getByRole('button', { name: '导出到手机日历' })).toHaveFocus();
    click.mockRestore();
  });
});
