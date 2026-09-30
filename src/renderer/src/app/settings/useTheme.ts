import { useLayoutEffect } from 'react';
import { useResolvedTheme } from './useResolvedTheme';

/**
 * Applies the resolved theme to the document so the CSS tokens switch with it, before the first frame paints: the
 * tokens exist only under `[data-theme]`, so a frame painted without it has no colors of its own.
 */
export function useTheme(): void {
  const theme = useResolvedTheme();
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
