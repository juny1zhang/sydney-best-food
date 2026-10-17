import { useEffect, useState } from 'react';

/** How many columns an auto-fit CSS grid is currently laid out in; `fallback` until it can be measured. */
export function useGridColumns(el: HTMLElement | null, fallback: number): number {
  const [columns, setColumns] = useState(fallback);

  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const n = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
      if (n) setColumns(n);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  return columns;
}
