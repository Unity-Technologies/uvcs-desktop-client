import { useMemo } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { hasLineTooLongToDraw } from '../../diff/viewer/longLines';
import { PIERRE_SURFACE_CSS, pierreThemeName } from '../../diff/viewer/pierreOptions';

/**
 * Options shared by the Pierre components used to resolve conflicts, for `text`: its lines scroll sideways, or wrap
 * when one is too long to draw unwrapped (`hasLineTooLongToDraw`), as a diff's do.
 */
export function usePierreOptions(text: string) {
  const theme = useResolvedTheme();
  const wraps = useMemo(() => hasLineTooLongToDraw([text]), [text]);
  return useMemo(
    () => ({ theme: pierreThemeName(theme), themeType: theme, overflow: wraps ? ('wrap' as const) : ('scroll' as const), disableFileHeader: true, unsafeCSS: PIERRE_SURFACE_CSS }),
    [theme, wraps],
  );
}
