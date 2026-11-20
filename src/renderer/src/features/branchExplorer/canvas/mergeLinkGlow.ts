/**
 * Every merge link glows faintly in its own color, so it reads at a glance as a merge passing over the graph, not as
 * a branch's line. The glow is thin layers stacked from the widest in, each faint: strongest at the line, fading to
 * nothing at its edge, without the hard border a single wide stroke has.
 */

/** How far the glow reaches past each side of the line (world px). */
export const GLOW_REACH = 4;
export const GLOW_LAYERS = 7;

/**
 * How strong the glow is at the line. Dark needs more: it lightens what is under it ('screen'), and a faint layer of
 * green on near-black otherwise only dims to a murky band.
 */
const GLOW_STRENGTH = { light: 0.16, dark: 0.25 };

/** The glow shows in full from this zoom up, fades out below it, and is gone at half of it: zoomed out, it only fattens the line. */
const GLOW_FULL_ZOOM = 0.7;

/**
 * Between the line and its glow, a gap of the background, solid at the line and fading out over `GAP_REACH`: the
 * merge reads as lying over the bands and lines it crosses.
 */
export const GAP_REACH = 1;
export const GAP_LAYERS = 5;
export const GAP_LAYER_ALPHA = 0.35;

/** The opacity of each of the glow's layers at a zoom, in a theme; 0 when the glow doesn't show. */
export function glowLayerAlpha(zoom: number, isDark: boolean): number {
  return ((isDark ? GLOW_STRENGTH.dark : GLOW_STRENGTH.light) * glowAtZoom(zoom)) / GLOW_LAYERS;
}

/** How much of the glow shows at a zoom: all of it from `GLOW_FULL_ZOOM` up, none from half of it down. */
export function glowAtZoom(zoom: number): number {
  const gone = GLOW_FULL_ZOOM / 2;
  return Math.min(1, Math.max(0, (zoom - gone) / (GLOW_FULL_ZOOM - gone)));
}

/** The widths of a soft effect's layers, widest first, around a line `lineWidth` wide. */
export function layerWidths(lineWidth: number, reach: number, layers: number): number[] {
  return Array.from({ length: layers }, (_, index) => lineWidth + (reach * 2 * (layers - index)) / layers);
}
