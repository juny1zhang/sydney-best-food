import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { SyncState } from '../hooks/usePicks';

/** Room kept between the explanation and the edge of the screen. */
const EDGE = 16;

interface SyncStatusProps {
  state: Exclude<SyncState, 'local'>;
  label: string;
  /** What the state means. Shown on press, since a hover title never shows on phones. */
  hint: string;
}

/** The masthead's sync pill: announces each change of state, and opens a short explanation when pressed. */
export function SyncStatus({ state, label, hint }: SyncStatusProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const hintId = useId();

  // Escape or a press anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      // Focus drops to the page when the explanation text is clicked; hand it back to the pill.
      const at = document.activeElement;
      if (!at || at === document.body || rootRef.current?.contains(at)) buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  // Centred under the pill, nudged back on screen when the pill sits near an edge (it wraps on phones).
  useLayoutEffect(() => {
    const el = hintRef.current;
    if (!open || !el) return;
    const place = () => {
      el.style.setProperty('--nudge', '0px');
      const { left, right } = el.getBoundingClientRect();
      const max = document.documentElement.clientWidth - EDGE;
      const nudge = left < EDGE ? EDGE - left : right > max ? max - right : 0;
      el.style.setProperty('--nudge', `${nudge}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, label, hint]);

  return (
    <li
      ref={rootRef}
      className={`sync sync--${state}`}
      onBlur={(e) => {
        // Tabbing away closes it; a click on the explanation itself doesn't.
        const to = e.relatedTarget as Node | null;
        if (to && !e.currentTarget.contains(to)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="sync__btn"
        aria-expanded={open}
        aria-controls={hintId}
        aria-describedby={hintId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sync__dot" aria-hidden="true" />
        <span aria-live="polite">{label}</span>
      </button>
      <p ref={hintRef} id={hintId} className="sync__hint" hidden={!open}>
        {hint}
      </p>
    </li>
  );
}
