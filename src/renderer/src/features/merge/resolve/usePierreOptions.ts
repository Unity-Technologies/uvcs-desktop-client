import { useMemo } from 'react';
import { useResolvedTheme } from '../../../app/settings/useTheme';

/** Paints Pierre's editor surface with the app's surface color, in both themes. */
const SURFACE_CSS = ':host{--diffs-bg:var(--bg-surface);background-color:var(--bg-surface)}';

/** Options shared by the Pierre components used to resolve conflicts. */
export function usePierreOptions() {
  const theme = useResolvedTheme();
  return useMemo(
    () => ({
      theme: theme === 'light' ? ('pierre-light' as const) : ('pierre-dark' as const),
      themeType: theme,
      disableFileHeader: true,
      unsafeCSS: SURFACE_CSS,
    }),
    [theme],
  );
}
