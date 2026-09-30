/**
 * The app's mark: a branch leaving the main line and merging back, in white on a blue rounded square, drawn on a
 * 64-unit square. The renderer draws it in the theme's colors (`AppMark`: the About dialog, the home screen, the top
 * bar).
 */
export const APP_MARK = {
  size: 64,
  tileRadius: 15,
  strokeWidth: 4,
  /** The main line, then the branch that leaves it and merges back. */
  lines: ['M24 16v32', 'M24 22c0 8 16 6 16 14s-16 6-16 12'],
  /** The changesets: where the branch starts, its head, the merge. */
  changesets: [
    { cx: 24, cy: 16 },
    { cx: 40, cy: 34 },
    { cx: 24, cy: 48 },
  ],
  changesetRadius: 4.5,
} as const;
