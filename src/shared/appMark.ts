/**
 * The app's mark: a branch leaving the main line and merging back, in white on a blue rounded square, drawn on a
 * 64-unit square. The renderer draws it in the theme's colors (`AppMark`: the About dialog, the home screen, the top
 * bar); `scripts/icons/makeAppIcons.mjs` rasterizes `appIconSvg` into the app's icons (`build/`).
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

/**
 * The icon's colors: the light theme's `--accent-hover` and `--accent` for the tile's gradient and `--accent-contrast`
 * for the glyph (`styles/tokens.css`), the mark as the About dialog draws it there (`appMark.test.ts` checks).
 */
export const APP_ICON_COLORS = { from: '#0860c7', to: '#0969da', glyph: '#ffffff' } as const;

/** The side of the icon's canvas, in pixels: the largest size any OS asks for (macOS's 512@2x). */
export const APP_ICON_CANVAS = 1024;

/** How the tile sits on the icon's canvas: on macOS's icon grid, or edge to edge (Windows, Linux). */
export type AppIconLayout = 'macOS' | 'edgeToEdge';

/**
 * The margin around the tile, in pixels of `APP_ICON_CANVAS`. macOS follows Apple's icon grid: an 824-pixel square
 * centered on the 1024 canvas, so the Dock shows the app the size of the others (a tile edge to edge looks oversized
 * there). Windows and Linux show icons as drawn: the tile fills the canvas.
 */
export function appIconTileInset(layout: AppIconLayout): number {
  return layout === 'macOS' ? 100 : 0;
}

/**
 * The icon as a standalone SVG, the source every icon file is rasterized from: the `APP_ICON_CANVAS` drawn at `pixels`
 * (each size of an icon file is drawn from the vectors, never scaled down from a larger bitmap).
 */
export function appIconSvg(layout: AppIconLayout, pixels: number = APP_ICON_CANVAS): string {
  const inset = appIconTileInset(layout);
  const scale = (APP_ICON_CANVAS - 2 * inset) / APP_MARK.size;
  const lines = APP_MARK.lines.map((d) => `<path d="${d}"/>`);
  const changesets = APP_MARK.changesets.map(
    ({ cx, cy }) => `<circle cx="${cx}" cy="${cy}" r="${APP_MARK.changesetRadius}" fill="${APP_ICON_COLORS.to}"/>`,
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${APP_ICON_CANVAS} ${APP_ICON_CANVAS}">`,
    '<defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">',
    `<stop offset="0" stop-color="${APP_ICON_COLORS.from}"/><stop offset="1" stop-color="${APP_ICON_COLORS.to}"/>`,
    '</linearGradient></defs>',
    `<g transform="translate(${inset} ${inset}) scale(${scale})">`,
    `<rect width="${APP_MARK.size}" height="${APP_MARK.size}" rx="${APP_MARK.tileRadius}" fill="url(#tile)"/>`,
    `<g fill="none" stroke="${APP_ICON_COLORS.glyph}" stroke-width="${APP_MARK.strokeWidth}" stroke-linecap="round">`,
    ...lines,
    ...changesets,
    '</g></g></svg>',
    '',
  ].join('\n');
}
