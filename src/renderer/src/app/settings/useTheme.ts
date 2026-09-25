import { useEffect } from 'react';
import { useResolvedTheme } from './useResolvedTheme';

/** Applies the resolved theme to the document so the CSS tokens switch with it. */
export function useTheme(): void {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
