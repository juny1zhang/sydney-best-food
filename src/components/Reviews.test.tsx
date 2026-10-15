import { render, screen, within } from '@testing-library/react';
import { RESTAURANTS } from '../data/restaurants';
import type { Restaurant, TaTake } from '../data/types';
import { ReviewsSection, TaChip, XhsChip } from './Reviews';

const base = RESTAURANTS[0];

function withReviews(extra: Partial<Restaurant>): Restaurant {
  return { ...base, xhs: undefined, ta: undefined, ...extra };
}

function ta(extra: Partial<TaTake>): TaTake {
  return { url: null, rating: null, reviews: null, rank: null, summary: '', praise: [], complaints: [], ...extra };
}

describe('reviews', () => {
  it('shows what Xiaohongshu and TripAdvisor say side by side', () => {
    const r = withReviews({
      xhs: { verdict: 'mixed', summary: '茄子被夸爆，但偏贵', praise: ['脆炸茄子'], complaints: ['人均偏贵'] },
      ta: ta({
        url: 'https://www.tripadvisor.com.au/x',
        rating: 4.5,
        reviews: 1234,
        rank: '悉尼第 20 名',
        summary: '服务好',
        praise: ['烤鸭'],
        complaints: ['吵'],
      }),
    });
    render(<ReviewsSection restaurant={r} />);
    const xhs = screen.getByRole('article', { name: '小红书' });
    expect(within(xhs).getByText('小红书褒贬不一')).toBeInTheDocument();
    expect(within(xhs).getByText('人均偏贵')).toBeInTheDocument();
    expect(within(xhs).queryByText(/仅供参考/)).not.toBeInTheDocument();
    expect(within(xhs).getByRole('link', { name: '去小红书看帖子' })).toHaveAttribute('href', expect.stringContaining('xiaohongshu.com'));
    const card = screen.getByRole('article', { name: 'TripAdvisor' });
    expect(within(card).getByText('TripAdvisor 4.5 · 1,234 条')).toBeInTheDocument();
    expect(within(card).getByText('悉尼第 20 名')).toBeInTheDocument();
    expect(within(card).queryByText(/仅供参考/)).not.toBeInTheDocument();
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

  it('still shows what the few Xiaohongshu posts say, without a verdict chip', () => {
    const r = withReviews({ xhs: { verdict: 'few', summary: '新店帖子很少，仅有的两篇都夸炭烤章鱼', praise: ['炭烤小章鱼嫩'], complaints: ['离市区远'] } });
    const { container } = render(<XhsChip restaurant={r} />);
    expect(container).toBeEmptyDOMElement();
    render(<ReviewsSection restaurant={r} />);
    const xhs = screen.getByRole('article', { name: '小红书' });
    expect(within(xhs).getByText('相关帖子很少，仅供参考。')).toBeInTheDocument();
    expect(within(xhs).getByText('新店帖子很少，仅有的两篇都夸炭烤章鱼')).toBeInTheDocument();
    expect(within(xhs).getByRole('heading', { name: '夸的' })).toBeInTheDocument();
    expect(within(xhs).getByText('离市区远')).toBeInTheDocument();
  });

  it("doesn't trust a TripAdvisor score from a handful of reviews, but keeps what they say", () => {
    const r = withReviews({ ta: ta({ rating: 1, reviews: 1, rank: '悉尼第 4,000 名', summary: '仅一条差评', complaints: ['等太久'] }) });
    const { container } = render(<TaChip restaurant={r} />);
    expect(container).toBeEmptyDOMElement();
    render(<ReviewsSection restaurant={r} />);
    const card = screen.getByRole('article', { name: 'TripAdvisor' });
    expect(within(card).getByText('只有 1 条评价，仅供参考。')).toBeInTheDocument();
    expect(within(card).getByText('仅一条差评')).toBeInTheDocument();
    expect(within(card).getByText('等太久')).toBeInTheDocument();
    // The rank comes from the same untrustworthy score.
    expect(within(card).queryByText('悉尼第 4,000 名')).not.toBeInTheDocument();
    expect(within(card).queryByText(/TripAdvisor \d/)).not.toBeInTheDocument();
  });

  it('says so plainly when a handful of reviews left nothing to summarise', () => {
    render(<ReviewsSection restaurant={withReviews({ ta: ta({ rating: 4, reviews: 3 }) })} />);
    expect(screen.getByText('只有 3 条评价，参考价值不大。')).toBeInTheDocument();
  });

  it('shows the summary of a listing that has no score yet', () => {
    const r = withReviews({ ta: ta({ reviews: 10, summary: '只有几条 2018 年的旧评', praise: ['麻辣够味'], complaints: ['服务慢'] }) });
    render(<ReviewsSection restaurant={r} />);
    const card = screen.getByRole('article', { name: 'TripAdvisor' });
    expect(within(card).getByText('只有 10 条评价，还没有评分。')).toBeInTheDocument();
    expect(within(card).getByText('只有几条 2018 年的旧评')).toBeInTheDocument();
    expect(within(card).getByText('服务慢')).toBeInTheDocument();
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
  });

  it('explains a missing score with what was found instead', () => {
    const r = withReviews({ ta: ta({ summary: '暂无悉尼店页面，只有墨尔本本店（4.3 分）。' }) });
    render(<ReviewsSection restaurant={r} />);
    const card = screen.getByRole('article', { name: 'TripAdvisor' });
    expect(within(card).getByText('没有 TripAdvisor 评分。')).toBeInTheDocument();
    expect(within(card).getByText('暂无悉尼店页面，只有墨尔本本店（4.3 分）。')).toBeInTheDocument();
  });

  it('falls back to a plain note when TripAdvisor had nothing at all', () => {
    const { unmount } = render(<ReviewsSection restaurant={withReviews({ ta: ta({ url: 'https://www.tripadvisor.com.au/y', reviews: 0 }) })} />);
    expect(screen.getByText('TripAdvisor 上评价太少，还没有评分。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去 TripAdvisor 看评价' })).toBeInTheDocument();
    unmount();
    render(<ReviewsSection restaurant={withReviews({ ta: ta({}) })} />);
    expect(screen.getByText('TripAdvisor 上没找到这家店。')).toBeInTheDocument();
  });

  it('renders nothing before anything was checked', () => {
    const { container } = render(<ReviewsSection restaurant={withReviews({})} />);
    expect(container).toBeEmptyDOMElement();
  });
});
