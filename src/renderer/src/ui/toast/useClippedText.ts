import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Whether a line-clamped element hides some of its text, followed as it resizes or its text changes. Measured only
 * while it's clamped (`clamped`); unclamped, it keeps the last answer, so the toggle that unfolded it stays.
 */
export function useClippedText(elementRef: RefObject<HTMLElement | null>, clamped: boolean, text: string | undefined): boolean {
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || !clamped) return;
    const measure = () => setClipped(element.scrollHeight > element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [clamped, text]);
  return clipped;
}
