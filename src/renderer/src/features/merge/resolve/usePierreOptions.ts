import { useMemo } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { PIERRE_SURFACE_CSS, pierreThemeName } from '../../diff/viewer/pierreOptions';

/** Options shared by the Pierre components used to resolve conflicts. */
export function usePierreOptions() {
  const theme = useResolvedTheme();
  return useMemo(
    () => ({ theme: pierreThemeName(theme), themeType: theme, disableFileHeader: true, unsafeCSS: PIERRE_SURFACE_CSS }),
    [theme],
  );
}
