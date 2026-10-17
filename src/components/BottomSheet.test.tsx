import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { BottomSheet } from './BottomSheet';

function Harness() {
  const [n, setN] = useState(0);
  return (
    <>
      <main data-sheet-inert="">背景</main>
      {/* A fresh onClose on every render, as most callers pass. */}
      <BottomSheet labelledBy="sheet-h" onClose={() => setN(0)} fallbackFocus={() => null}>
        <h2 id="sheet-h">第 {n} 次</h2>
        <button type="button" onClick={() => setN((x) => x + 1)}>
          加一
        </button>
      </BottomSheet>
    </>
  );
}

describe('BottomSheet', () => {
  it('keeps focus and the inert background while its parent re-renders', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: '加一' });
    await user.click(button);
    await user.click(button);
    expect(screen.getByRole('heading', { name: '第 2 次' })).toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(screen.getByText('背景')).toHaveAttribute('inert');
  });
});
