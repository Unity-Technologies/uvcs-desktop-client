import type { FileDiffOptions } from '@pierre/diffs/react';
import type { ResolvedTheme } from '../../../app/settings/useResolvedTheme';

/**
 * Pierre derives every diff tint from `--diffs-bg`; seeding it with our surface color makes
 * diffs blend with the app in both themes while keeping Pierre's syntax and add/remove colors.
 */
export const PIERRE_SURFACE_CSS = ':host{--diffs-bg:var(--bg-surface);background-color:var(--bg-surface)}';

interface DiffAppearance {
  theme: ResolvedTheme;
  layout: 'split' | 'unified';
  collapseUnchanged: boolean;
  wrapLines: boolean;
}

export function pierreThemeName(theme: ResolvedTheme): 'pierre-light' | 'pierre-dark' {
  return theme === 'dark' ? 'pierre-dark' : 'pierre-light';
}

export function pierreDiffOptions<LAnnotation = undefined>({ theme, layout, collapseUnchanged, wrapLines }: DiffAppearance): FileDiffOptions<LAnnotation, undefined> {
  return {
    theme: pierreThemeName(theme),
    themeType: theme,
    diffStyle: layout,
    overflow: wrapLines ? 'wrap' : 'scroll',
    diffIndicators: 'bars',
    hunkSeparators: 'line-info-basic',
    lineDiffType: 'word',
    expandUnchanged: !collapseUnchanged,
    disableFileHeader: true,
    stickyHeader: false,
    unsafeCSS: PIERRE_SURFACE_CSS,
  };
}
