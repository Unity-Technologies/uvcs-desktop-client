import { useEffect, useState, type RefObject } from 'react';

/** The element's size, followed as it is resized; 0 × 0 until measured. */
export function useSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
