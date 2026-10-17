import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareDialog } from './PlanDialogs';

describe('ShareDialog', () => {
  it('shows the site link and copies it', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onClose = vi.fn();
    render(<ShareDialog url="https://example.com/" onClose={onClose} fallbackFocus={() => null} />);

    const dialog = screen.getByRole('dialog', { name: '分享给家人' });
    expect(dialog).toHaveTextContent('大家打开看到的是同一份十二月计划');
    expect(screen.getByLabelText('网站链接')).toHaveValue('https://example.com/');
    await user.click(screen.getByRole('button', { name: '复制链接' }));
    expect(writeText).toHaveBeenCalledWith('https://example.com/');
    expect(screen.getByText('已复制，可以粘贴给家人了。')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
