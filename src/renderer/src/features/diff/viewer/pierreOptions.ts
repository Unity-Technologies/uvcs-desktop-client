import type { FileDiffOptions, FileOptions } from '@pierre/diffs/react';
import type { ResolvedTheme } from '../../../app/settings/useResolvedTheme';

/**
 * Pierre derives every diff tint from `--diffs-bg`; seeding it with our surface color makes
 * diffs blend with the app in both themes while keeping Pierre's syntax and add/remove colors.
 * Code takes the app's code font, whose stack has each OS's (Pierre's own knows neither Cascadia nor DejaVu).
 */
export const PIERRE_SURFACE_CSS = ':host{--diffs-bg:var(--bg-surface);background-color:var(--bg-surface);--diffs-font-family:var(--font-mono)}';

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

/** The same look for one file on its own, e.g. edited while its diff has no lines to show. */
export function pierreFileOptions({ theme, wrapLines }: Pick<DiffAppearance, 'theme' | 'wrapLines'>): FileOptions<undefined, undefined> {
  return {
    theme: pierreThemeName(theme),
    themeType: theme,
    overflow: wrapLines ? 'wrap' : 'scroll',
    disableFileHeader: true,
    unsafeCSS: PIERRE_SURFACE_CSS,
  };
}
