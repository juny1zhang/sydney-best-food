import type { Restaurant, TaTake, XhsTake, XhsVerdict } from '../data/types';

/** Below this many reviews a TripAdvisor score says more about luck than the restaurant. */
const MIN_TA_REVIEWS = 20;

const LABEL: Record<Exclude<XhsVerdict, 'few'>, string> = {
  recommend: '小红书好评',
  mixed: '小红书褒贬不一',
  avoid: '小红书差评多',
};

/** Search for the restaurant on Xiaohongshu, the way the reviews were gathered. */
export function xhsSearchUrl(r: Restaurant): string {
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(`${r.nameZh || r.name} 悉尼`)}`;
}

/** Small chip for list rows; nothing when there's no clear signal. */
export function XhsChip({ restaurant: r }: { restaurant: Restaurant }) {
  const v = r.xhs?.verdict;
  if (!v || v === 'few') return null;
  return <span className={`xhs-chip xhs-chip--${v}`}>{LABEL[v]}</span>;
}

/** "TripAdvisor 4.5 · 1,234 条" for list rows. */
export function TaChip({ restaurant: r }: { restaurant: Restaurant }) {
  const ta = r.ta;
  if (!ta?.rating || (ta.reviews ?? 0) < MIN_TA_REVIEWS) return null;
  return (
    <span className="ta-chip">
      TripAdvisor {ta.rating.toFixed(1)}
      {ta.reviews ? ` · ${ta.reviews.toLocaleString('en-US')} 条` : ''}
    </span>
  );
}

function Points({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="review-points">
      <h4>{title}</h4>
      <ul>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function saysAnything(take: XhsTake | TaTake): boolean {
  return Boolean(take.summary || take.praise.length || take.complaints.length);
}

function XhsBody({ xhs }: { xhs: XhsTake }) {
  const few = xhs.verdict === 'few';
  if (few && !saysAnything(xhs)) return <p className="muted">相关帖子很少，看不出明显的口碑。</p>;
  return (
    <>
      {few && <p className="muted">相关帖子很少，仅供参考。</p>}
      {xhs.summary && <p className="review-card__summary">{xhs.summary}</p>}
      <Points title="夸的" items={xhs.praise} />
      <Points title="吐槽的" items={xhs.complaints} />
    </>
  );
}

/** A thin sample still gets its summary, under a line saying how far to trust it. */
function TaBody({ ta }: { ta: TaTake }) {
  const said = saysAnything(ta);
  let caveat = '';
  if (!ta.rating) {
    if (!said) return <p className="muted">{ta.url ? 'TripAdvisor 上评价太少，还没有评分。' : 'TripAdvisor 上没找到这家店。'}</p>;
    caveat = ta.reviews ? `只有 ${ta.reviews} 条评价，还没有评分。` : '没有 TripAdvisor 评分。';
  } else if ((ta.reviews ?? 0) < MIN_TA_REVIEWS) {
    const few = ta.reviews ? `只有 ${ta.reviews} 条评价` : '评价很少';
    if (!said) return <p className="muted">{few}，参考价值不大。</p>;
    caveat = `${few}，仅供参考。`;
  }
  return (
    <>
      {caveat ? <p className="muted">{caveat}</p> : ta.rank && <p className="muted small">{ta.rank}</p>}
      {ta.summary && <p className="review-card__summary">{ta.summary}</p>}
      <Points title="好评" items={ta.praise} />
      <Points title="差评" items={ta.complaints} />
    </>
  );
}

/** The restaurant page's "what people say" section: Xiaohongshu and TripAdvisor side by side. */
export function ReviewsSection({ restaurant: r }: { restaurant: Restaurant }) {
  const { xhs, ta } = r;
  if (!xhs && !ta) return null;
  return (
    <section aria-labelledby="detail-reviews-h" className="detail__section">
      <h2 id="detail-reviews-h">网友口碑</h2>
      <div className="reviews">
        {xhs && (
          <article className="review-card" aria-labelledby="review-xhs-h">
            <div className="review-card__head">
              <h3 id="review-xhs-h">小红书</h3>
              <XhsChip restaurant={r} />
            </div>
            <XhsBody xhs={xhs} />
            <a className="review-card__link" href={xhsSearchUrl(r)} target="_blank" rel="noreferrer">
              去小红书看帖子
            </a>
          </article>
        )}
        {ta && (
          <article className="review-card" aria-labelledby="review-ta-h">
            <div className="review-card__head">
              <h3 id="review-ta-h">TripAdvisor</h3>
              <TaChip restaurant={r} />
            </div>
            <TaBody ta={ta} />
            {ta.url && (
              <a className="review-card__link" href={ta.url} target="_blank" rel="noreferrer">
                去 TripAdvisor 看评价
              </a>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
