import { useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';

interface ShareProps {
  url: string;
  onClose: () => void;
  fallbackFocus: () => HTMLElement | null;
}

/** The site's address with copy and system-share buttons; everyone who opens it edits the same plan. */
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
      await navigator.share({ title: '悉尼吃什么 · 十二月计划', text: '我们十二月吃什么都在这里，打开就能看，也能一起改：', url });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  };

  return (
    <BottomSheet labelledBy="share-h" onClose={onClose} fallbackFocus={fallbackFocus} variant="dialog">
      <div className="dialog">
        <h2 id="share-h">分享给家人</h2>
        <p className="muted">
          把网址发给家人，微信、短信都可以。大家打开看到的是同一份十二月计划，谁选了店、订了位都会马上同步，不用登录。
        </p>
        <label className="field" htmlFor="share-url">
          网站链接
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
