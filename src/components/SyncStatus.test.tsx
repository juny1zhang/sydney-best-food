import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncStatus } from './SyncStatus';

const OFFLINE_HINT = '连不上共享日历，正在重试；改动先存在这台设备上';

function renderPill() {
  return render(
    <>
      <ul>
        <SyncStatus state="offline" label="连不上" hint={OFFLINE_HINT} />
      </ul>
      <button type="button">别处</button>
    </>,
  );
}

describe('sync status', () => {
  it('explains itself on press, which phones can do and a hover title never could', async () => {
    const user = userEvent.setup();
    renderPill();
    const pill = screen.getByRole('button', { name: '连不上' });
    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(pill).toHaveAccessibleDescription(OFFLINE_HINT);
    expect(screen.queryByText(OFFLINE_HINT)).not.toBeVisible();

    await user.click(pill);
    expect(pill).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(OFFLINE_HINT)).toBeVisible();

    await user.click(pill);
    expect(screen.queryByText(OFFLINE_HINT)).not.toBeVisible();
  });

  it('closes with Escape, a press elsewhere, or tabbing away', async () => {
    const user = userEvent.setup();
    renderPill();
    const pill = screen.getByRole('button', { name: '连不上' });

    await user.click(pill);
    await user.click(screen.getByText(OFFLINE_HINT));
    expect(screen.getByText(OFFLINE_HINT)).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByText(OFFLINE_HINT)).not.toBeVisible();
    expect(pill).toHaveFocus();

    await user.click(pill);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText(OFFLINE_HINT)).not.toBeVisible();

    await user.click(pill);
    await user.tab();
    expect(screen.getByRole('button', { name: '别处' })).toHaveFocus();
    expect(screen.queryByText(OFFLINE_HINT)).not.toBeVisible();
  });

  it('announces when the state changes', () => {
    const { rerender } = renderPill();
    const pill = screen.getByRole('button', { name: '连不上' });
    rerender(
      <ul>
        <SyncStatus state="live" label="实时同步" hint="打开这个网站的人看到的是同一份日历，改动会马上同步" />
      </ul>,
    );
    expect(pill).toHaveAccessibleName('实时同步');
    expect(screen.getByText('实时同步')).toHaveAttribute('aria-live', 'polite');
    expect(pill.closest('li')).toHaveClass('sync', 'sync--live');
  });
});
