import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/** Applies the theme preference to the document, following the OS when set to "system". */
export function useTheme(): void {
  const { theme } = useSettings();
  const [systemIsDark, setSystemIsDark] = useState(darkQuery.matches);

  useEffect(() => {
    const onChange = (event: MediaQueryListEvent): void => setSystemIsDark(event.matches);
    darkQuery.addEventListener('change', onChange);
    return () => darkQuery.removeEventListener('change', onChange);
  }, []);

  const resolved = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
}
