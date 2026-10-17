import { useRef, useState } from 'react';
import { MONTH_INDEX, YEAR } from '../data/december';
import { dateLabel } from '../lib/calendar';
import { entryName, isReserved, mealLabel, planItems, reservedTime } from '../lib/plan';
import { countPicks, type SharedPlan } from '../lib/share';
import { BottomSheet } from './BottomSheet';

interface ShareProps {
  url: string;
  onClose: () => void;
  fallbackFocus: () => HTMLElement | null;
}

/** Shows the share link with copy and system-share buttons. */
export function ShareDialog({ url, onClose, fallbackFocus }: ShareProps) {
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('已复制，可以粘贴给家人了。');
    } catch {
      inputRef.current?.select();
      setStatus('没能自动复制，链接已选中，请手动复制。');
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: '悉尼吃什么 · 我的十二月计划', text: '这是我十二月的吃饭计划，打开链接就能导入：', url });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  };

  return (
    <BottomSheet labelledBy="share-h" onClose={onClose} fallbackFocus={fallbackFocus} variant="dialog">
      <div className="dialog">
        <h2 id="share-h">分享计划</h2>
        <p className="muted">
          把这个链接发给家人，微信、短信都可以。对方打开后，可以把你的安排合并进自己的计划，或者直接替换。链接里带着你选的店、订位信息和想去清单，不用登录。
        </p>
        <label className="field" htmlFor="share-url">
          分享链接
          <input id="share-url" ref={inputRef} value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
        </label>
        <div className="dialog__actions">
          <button type="button" className="btn btn--primary" onClick={copy}>
            复制链接
          </button>
          {canNativeShare && (
            <button type="button" className="btn btn--ghost" onClick={nativeShare}>
              用其他应用分享
            </button>
          )}
        </div>
        <p className="muted small" aria-live="polite">
          {status}
        </p>
      </div>
    </BottomSheet>
  );
}

interface ImportProps {
  plan: SharedPlan;
  myCount: number;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
  fallbackFocus: () => HTMLElement | null;
}

const PREVIEW = 6;

/** Asks what to do with a plan that arrived through a share link. */
export function ImportDialog({ plan, myCount, onMerge, onReplace, onCancel, fallbackFocus }: ImportProps) {
  const meals = countPicks(plan.picks);
  const items = planItems(plan.picks).filter((i) => i.entry.status !== 'booked');

  return (
    <BottomSheet labelledBy="import-h" onClose={onCancel} fallbackFocus={fallbackFocus} variant="dialog">
      <div className="dialog">
        <h2 id="import-h">导入分享的计划</h2>
        <p>
          链接里有 {meals} 餐安排{plan.wishlist.length ? `、${plan.wishlist.length} 家想去的店` : ''}。
        </p>
        {items.length > 0 && (
          <ul className="dialog__preview">
            {items.slice(0, PREVIEW).map(({ day, meal, entry }) => {
              const time = reservedTime(entry);
              return (
                <li key={`${day}-${meal}`}>
                  <span className="muted small">
                    {dateLabel(YEAR, MONTH_INDEX, day)} {mealLabel(meal)}
                  </span>
                  <span className="dialog__preview-name">{entryName(entry)}</span>
                  {isReserved(entry) && <span className="pill pill--booked">已预订{time ? ` · ${time}` : ''}</span>}
                </li>
              );
            })}
            {items.length > PREVIEW && <li className="muted small">……还有 {items.length - PREVIEW} 餐</li>}
          </ul>
        )}
        {myCount > 0 && (
          <p className="muted small">
            你现在已经有 {myCount} 餐安排。合并：保留你的安排，同一餐以链接里的为准。替换：清空你的安排，换成链接里的。
          </p>
        )}
        <div className="dialog__actions">
          <button type="button" className="btn btn--primary" onClick={onMerge}>
            {myCount > 0 ? '合并到我的计划' : '导入'}
          </button>
          {myCount > 0 && (
            <button type="button" className="btn btn--ghost" onClick={onReplace}>
              替换我的计划
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            不导入
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
