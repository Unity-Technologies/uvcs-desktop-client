import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

export type ResolvedTheme = 'light' | 'dark';

/** The theme in effect: the preference, or the OS appearance when set to "system". */
export function useResolvedTheme(): ResolvedTheme {
  const { theme } = useSettings();
  const [systemIsDark, setSystemIsDark] = useState(darkQuery.matches);

  useEffect(() => {
    const onChange = (event: MediaQueryListEvent): void => setSystemIsDark(event.matches);
    darkQuery.addEventListener('change', onChange);
    return () => darkQuery.removeEventListener('change', onChange);
  }, []);

  return theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;
}

/** Applies the theme preference to the document. */
export function useTheme(): void {
  const resolved = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
}
