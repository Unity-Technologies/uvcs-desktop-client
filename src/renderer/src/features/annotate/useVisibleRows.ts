import { useEffect, useState } from 'react';
import { visibleRows, type RowRange } from './visibleRows';

const OVERSCAN = 20;

/** The rows in view of `scroller` (fixed height, from `offsetTop`), updated as it scrolls or resizes. */
export function useVisibleRows(scroller: HTMLElement | null, count: number, rowHeight: number, offsetTop: number): RowRange {
  const [range, setRange] = useState<RowRange>({ first: 0, end: 0 });

  useEffect(() => {
    if (!scroller) return;
    const update = (): void => {
      const next = visibleRows({ scrollTop: scroller.scrollTop, height: scroller.clientHeight }, { count, rowHeight, offsetTop, overscan: OVERSCAN });
      setRange((current) => (current.first === next.first && current.end === next.end ? current : next));
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [scroller, count, rowHeight, offsetTop]);

  return range;
}
