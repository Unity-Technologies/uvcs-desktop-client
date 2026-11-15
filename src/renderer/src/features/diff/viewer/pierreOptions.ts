import type { FileDiffOptions, FileOptions } from '@pierre/diffs/react';
import type { ResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { pierreThemeName } from '../../../lib/codeTheme';
import type { DiffLayout } from './diffPreferencesStore';
import { pierreTint } from './pierreTint';

/**
 * Pierre derives every diff tint from `--diffs-bg`; seeding it with our surface color makes
 * diffs blend with the app in both themes while keeping Pierre's syntax and add/remove colors.
 * Code takes the app's code font, whose stack has each OS's (Pierre's own knows neither Cascadia nor DejaVu), at
 * 12px rather than Pierre's 13px: the size the classic desktop client shows code at. Only the font shrinks: lines
 * stay 20px tall, the height Pierre's virtualizer and Annotate's `ANNOTATION_LINE_HEIGHT` count on.
 */
export const PIERRE_SURFACE_CSS =
  ':host{--diffs-bg:var(--bg-surface);background-color:var(--bg-surface);--diffs-font-family:var(--font-mono);--diffs-font-size:12px}';

/**
 * How a diff marks the words two lines change: word by word, nothing on lines past 1,000 characters (Pierre's own
 * default, written out so moved code is marked the same way: `movedWordMarks`).
 */
export const WORD_MARKS = { lineDiffType: 'word', maxLineDiffLength: 1_000 } as const;

interface DiffAppearance {
  theme: ResolvedTheme;
  layout: DiffLayout;
  collapseUnchanged: boolean;
  wrapLines: boolean;
}

/**
 * A row of comments under an added or removed line takes that line's tint, so it reads as part of the line it's on:
 * the content's row only on the side holding the comments (`:has(slot)`; the other side's row is an empty buffer),
 * and its gutter with the change bar, on a side holding such a row.
 */
function annotationRowTint(lineType: 'change-addition' | 'change-deletion', base: string): string {
  const mixTarget = `var(${base})`;
  const tint = pierreTint(mixTarget, 88, 80);
  const gutterTint = pierreTint(mixTarget, 91, 85);
  const row = `[data-line][data-line-type=${lineType}] + [data-line-annotation]`;
  return (
    `${row}:has(slot){--diffs-computed-decoration-bg:${tint}}` +
    `[data-code]:has(${row} slot) [data-column-number][data-line-type=${lineType}] + [data-gutter-buffer=annotation]{` +
    // The change bar as a background: Pierre's `::before` on a gutter buffer is what keeps the gutter's width.
    `--diffs-computed-decoration-bg:${gutterTint};` +
    `background-image:linear-gradient(${mixTarget},${mixTarget});background-size:4px 100%;background-repeat:no-repeat}`
  );
}

const ANNOTATION_ROW_TINT_CSS =
  annotationRowTint('change-addition', '--diffs-addition-base') + annotationRowTint('change-deletion', '--diffs-deletion-base');

export function pierreDiffOptions<LAnnotation = undefined>({ theme, layout, collapseUnchanged, wrapLines }: DiffAppearance): FileDiffOptions<LAnnotation, undefined> {
  return {
    theme: pierreThemeName(theme),
    themeType: theme,
    diffStyle: layout,
    overflow: wrapLines ? 'wrap' : 'scroll',
    diffIndicators: 'bars',
    hunkSeparators: 'line-info-basic',
    ...WORD_MARKS,
    expandUnchanged: !collapseUnchanged,
    disableFileHeader: true,
    stickyHeader: false,
    unsafeCSS: PIERRE_SURFACE_CSS + ANNOTATION_ROW_TINT_CSS,
  };
}

/**
 * A snippet's rows run edge to edge in their box, from the border above them to the one below: Pierre leaves a gap
 * (`--diffs-gap-block`, 8px) above the first row and under the last, which reads as the box's own padding. With no
 * line numbers its gutter is the change bar alone, and Pierre's line between gutter and code (`--diffs-gap-style`, 2px
 * of the surface) would split the bar from the row's tint: none, so the tint runs on from the bar.
 */
const SNIPPET_ROWS_EDGE_TO_EDGE_CSS = ':host{--diffs-gap-block:0px;--diffs-gap-style:none}';

/**
 * A few lines' diff shown whole inside a comment (a change request's Suggested change): the code's diff as the viewer
 * shows it (its colors, bars and word marks), one column, with no line numbers (the comment names its lines, and they'd
 * number the snippet from 1, not the file), every line shown and no tints for comment rows, as it holds none.
 */
export function pierreSnippetDiffOptions(theme: ResolvedTheme): FileDiffOptions<undefined, undefined> {
  return {
    ...pierreDiffOptions({ theme, layout: 'unified', collapseUnchanged: false, wrapLines: false }),
    disableLineNumbers: true,
    unsafeCSS: PIERRE_SURFACE_CSS + SNIPPET_ROWS_EDGE_TO_EDGE_CSS,
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
