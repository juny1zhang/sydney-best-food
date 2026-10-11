import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

interface SheetProps {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal sheet that slides up from the bottom on phones. */
export function BottomSheet({ labelledBy, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, summary');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        <div className="sheet__bar">
          <span className="sheet__handle" aria-hidden="true" />
          <button type="button" className="icon-btn" aria-label="关闭" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
