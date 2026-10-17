import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteFooter } from './SiteFooter';

describe('feedback', () => {
  it('sends a note with where it was written from', async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockResolvedValue(undefined);
    render(<SiteFooter page="restaurant:aria" verifiedOn="2026 年 10 月 11 日" shared send={send} />);
    await user.type(screen.getByRole('textbox', { name: '想说的话' }), '想加一家早餐店');
    await user.type(screen.getByRole('textbox', { name: /你的称呼/ }), '小米');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(send).toHaveBeenCalledWith({ message: '想加一家早餐店', name: '小米', page: 'restaurant:aria' });
    expect(await screen.findByText('收到了，谢谢！')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '再写一条' }));
    expect(screen.getByRole('textbox', { name: '想说的话' })).toHaveValue('');
  });

  it('keeps the note and says so when sending fails', async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    render(<SiteFooter page="main" verifiedOn="2026 年 10 月 11 日" shared send={send} />);
    await user.type(screen.getByRole('textbox', { name: '想说的话' }), '日历很好用');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('没发出去');
    expect(screen.getByRole('textbox', { name: '想说的话' })).toHaveValue('日历很好用');
  });

  it('does not send blank notes', async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(<SiteFooter page="main" verifiedOn="2026 年 10 月 11 日" shared send={send} />);
    await user.type(screen.getByRole('textbox', { name: '想说的话' }), '   ');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('hides the form when there is nowhere to send it', () => {
    render(<SiteFooter page="main" verifiedOn="2026 年 10 月 11 日" shared={false} send={null} />);
    expect(screen.queryByRole('heading', { name: '意见反馈' })).not.toBeInTheDocument();
    expect(screen.getByText(/只保存在这台设备/)).toBeInTheDocument();
  });
});
