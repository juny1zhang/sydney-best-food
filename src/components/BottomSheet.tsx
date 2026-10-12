import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

interface SheetProps {
  labelledBy: string;
  onClose: () => void;
  /** Where focus goes on close when the element that opened the sheet is gone. */
  fallbackFocus: () => HTMLElement | null;
  children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), a[href], input, textarea, select, summary';

/** Modal sheet that slides up from the bottom on phones and tablets. */
export function BottomSheet({ labelledBy, onClose, fallbackFocus, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;

  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const opener = active && active !== document.body ? active : null;
    ref.current?.focus();
    // Keep Tab and assistive tech inside the sheet: everything marked data-sheet-inert goes inert.
    const background = Array.from(document.querySelectorAll<HTMLElement>('[data-sheet-inert]'));
    background.forEach((el) => el.setAttribute('inert', ''));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      const sheet = ref.current;
      if (!sheet) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      // Focus can fall to <body> when the pressed control unmounts; pull it back in.
      if (!current || !sheet.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (current === first || current === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      background.forEach((el) => el.removeAttribute('inert'));
      const target = opener && opener.isConnected ? opener : fallbackRef.current();
      target?.focus({ preventScroll: true });
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
