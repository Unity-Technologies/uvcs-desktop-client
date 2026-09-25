import { useEffect, useState, type RefObject } from 'react';
import { readGraphPalette, type GraphPalette } from './graphPalette';

/** The drawing palette, re-read whenever the app theme changes. */
export function useGraphPalette(elementRef: RefObject<HTMLElement | null>): GraphPalette | null {
  const [palette, setPalette] = useState<GraphPalette | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const refresh = (): void => setPalette(readGraphPalette(element));
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [elementRef]);

  return palette;
}
