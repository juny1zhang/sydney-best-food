import { render, screen, within } from '@testing-library/react';
import { RESTAURANTS } from '../data/restaurants';
import type { Restaurant } from '../data/types';
import { ReviewsSection, TaChip, XhsChip } from './Reviews';

const base = RESTAURANTS[0];

function withReviews(extra: Partial<Restaurant>): Restaurant {
  return { ...base, xhs: undefined, ta: undefined, ...extra };
}

describe('reviews', () => {
  it('shows what Xiaohongshu and TripAdvisor say side by side', () => {
    const r = withReviews({
      xhs: { verdict: 'mixed', summary: '茄子被夸爆，但偏贵', praise: ['脆炸茄子'], complaints: ['人均偏贵'] },
      ta: { url: 'https://www.tripadvisor.com.au/x', rating: 4.5, reviews: 1234, rank: '悉尼第 20 名', summary: '服务好', praise: ['烤鸭'], complaints: ['吵'] },
    });
    render(<ReviewsSection restaurant={r} />);
    const xhs = screen.getByRole('article', { name: '小红书' });
    expect(within(xhs).getByText('小红书褒贬不一')).toBeInTheDocument();
    expect(within(xhs).getByText('人均偏贵')).toBeInTheDocument();
    expect(within(xhs).getByRole('link', { name: '去小红书看帖子' })).toHaveAttribute('href', expect.stringContaining('xiaohongshu.com'));
    const ta = screen.getByRole('article', { name: 'TripAdvisor' });
    expect(within(ta).getByText('TripAdvisor 4.5 · 1,234 条')).toBeInTheDocument();
    expect(within(ta).getByText('悉尼第 20 名')).toBeInTheDocument();
  });

  it('stays quiet when there is no signal', () => {
    const r = withReviews({ xhs: { verdict: 'few', summary: '', praise: [], complaints: [] } });
    const { container } = render(
      <>
        <XhsChip restaurant={r} />
        <TaChip restaurant={r} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
    render(<ReviewsSection restaurant={r} />);
    expect(screen.getByText('相关帖子很少，看不出明显的口碑。')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'TripAdvisor' })).not.toBeInTheDocument();
  });

  it("doesn't trust a TripAdvisor score from a handful of reviews", () => {
    const r = withReviews({ ta: { url: null, rating: 1, reviews: 1, rank: null, summary: '', praise: [], complaints: ['等太久'] } });
    const { container } = render(<TaChip restaurant={r} />);
    expect(container).toBeEmptyDOMElement();
    render(<ReviewsSection restaurant={r} />);
    expect(screen.getByText('只有 1 条评价，参考价值不大。')).toBeInTheDocument();
    expect(screen.queryByText('等太久')).not.toBeInTheDocument();
  });

  it('renders nothing before anything was checked', () => {
    const { container } = render(<ReviewsSection restaurant={withReviews({})} />);
    expect(container).toBeEmptyDOMElement();
  });
});
