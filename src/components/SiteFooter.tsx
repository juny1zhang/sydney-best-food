import { useRef, useState, type FormEvent } from 'react';
import { FEEDBACK_MAX, NAME_MAX, sendFeedback, type SendFeedback } from '../lib/feedback';

type Status = 'idle' | 'sending' | 'sent' | 'error';

interface FooterProps {
  /** Where the visitor is, recorded with their feedback. */
  page: string;
  verifiedOn: string;
  /** Whether picks are shared live or kept on this device. */
  shared: boolean;
  send?: SendFeedback | null;
}

export function SiteFooter({ page, verifiedOn, shared, send = sendFeedback }: FooterProps) {
  return (
    <footer className="site-foot" data-sheet-inert="">
      {send && <FeedbackForm page={page} send={send} />}
      <p className="foot">
        排名依据 2026 年公开榜单与媒体推荐整理，营业状态核对于 {verifiedOn}。每家店的“评价依据”里有来源链接。
        {shared ? '选好的店会实时同步给打开这个网站的每个人。' : '你选的店只保存在这台设备的浏览器里。'}
      </p>
    </footer>
  );
}

function FeedbackForm({ page, send }: { page: string; send: SendFeedback }) {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const doneRef = useRef<HTMLParagraphElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      await send({ message, name, page });
    } catch {
      setStatus('error');
      return;
    }
    setMessage('');
    setStatus('sent');
    requestAnimationFrame(() => doneRef.current?.focus());
  };

  return (
    <section className="feedback" aria-labelledby="fb-h">
      <div className="feedback__intro">
        <h2 id="fb-h">意见反馈</h2>
        <p>哪家店的信息不对、想加哪家店、页面哪里不好用，都可以写在这里。</p>
      </div>
      {status === 'sent' ? (
        <div className="feedback__done">
          <p ref={doneRef} tabIndex={-1}>
            收到了，谢谢！
          </p>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setStatus('idle');
              requestAnimationFrame(() => messageRef.current?.focus());
            }}
          >
            再写一条
          </button>
        </div>
      ) : (
        <form className="feedback__form" onSubmit={submit}>
          <label className="field">
            想说的话
            <textarea
              ref={messageRef}
              value={message}
              maxLength={FEEDBACK_MAX}
              rows={4}
              required
              placeholder="例如：某家店的营业时间变了，或者想加一家店"
              onChange={(e) => {
                setMessage(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
            />
          </label>
          <label className="field">
            你的称呼（可不填）
            <input value={name} maxLength={NAME_MAX} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="feedback__actions">
            <button type="submit" className="btn btn--primary" disabled={status === 'sending'}>
              {status === 'sending' ? '发送中…' : '发送'}
            </button>
            <span className="muted small">
              {message.length}/{FEEDBACK_MAX}
            </span>
          </div>
          {status === 'error' && (
            <p className="warn" role="alert">
              没发出去，检查一下网络再试一次。
            </p>
          )}
        </form>
      )}
    </section>
  );
}
