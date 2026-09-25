import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';

export type ResolvedTheme = 'light' | 'dark';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/** The theme actually in use: the user's choice, or the OS appearance when set to "system". */
export function useResolvedTheme(): ResolvedTheme {
  const { theme } = useSettings();
  const [systemIsDark, setSystemIsDark] = useState(darkQuery.matches);

  useEffect(() => {
    const onChange = (event: MediaQueryListEvent): void => setSystemIsDark(event.matches);
    darkQuery.addEventListener('change', onChange);
    return () => darkQuery.removeEventListener('change', onChange);
  }, []);

  if (theme !== 'system') return theme;
  return systemIsDark ? 'dark' : 'light';
}
