import { useEffect, useState, type RefObject } from 'react';
import { readModelPalette, type ModelPalette } from './modelPalette';

/** The 3D view's palette, read again whenever the app theme changes. */
export function useModelPalette(elementRef: RefObject<HTMLElement | null>): ModelPalette | null {
  const [palette, setPalette] = useState<ModelPalette | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const refresh = (): void => setPalette(readModelPalette(element));
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [elementRef]);

  return palette;
}
