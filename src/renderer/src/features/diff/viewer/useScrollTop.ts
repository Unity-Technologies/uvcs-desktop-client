import { useEffect, useState, type RefObject } from 'react';

/**
 * How far the element in `containerRef` is scrolled down, read as it scrolls: the browser sends one scroll event a
 * frame, so what follows it (the diff's thumb) moves with the content, not a frame behind.
 */
export function useScrollTop(containerRef: RefObject<HTMLElement | null>): number {
  const [scrollTop, setScrollTop] = useState(() => containerRef.current?.scrollTop ?? 0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const read = (): void => setScrollTop(container.scrollTop);
    container.addEventListener('scroll', read, { passive: true });
    read();
    return () => container.removeEventListener('scroll', read);
  }, [containerRef]);
  return scrollTop;
}
