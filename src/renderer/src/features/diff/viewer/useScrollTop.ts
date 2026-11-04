import { useEffect, useState, type RefObject } from 'react';

/** How far the element in `containerRef` is scrolled down, read once a frame while it scrolls. */
export function useScrollTop(containerRef: RefObject<HTMLElement | null>): number {
  const [scrollTop, setScrollTop] = useState(() => containerRef.current?.scrollTop ?? 0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const read = (): void => {
      frame = 0;
      setScrollTop(container.scrollTop);
    };
    const onScroll = (): void => {
      frame ||= requestAnimationFrame(read);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    read();
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener('scroll', onScroll);
    };
  }, [containerRef]);
  return scrollTop;
}
