/**
 * Where the workspace kind badge (`WorkspaceKindBadge`) draws its disc and glyph, in the units of its SVG's viewBox.
 * The disc, its rim and the glyph share one SVG so the glyph is centered by these numbers, never by layout: centered
 * with CSS, the glyph landed on a half pixel that Windows and macOS rounded differently, and showed off-center.
 */

/** The badge's viewBox is a square this many units wide; CSS scales it to the badge's size. */
export const BADGE_VIEW_BOX = 16;

/** The disc of the raised surface, centered, with its rim drawn just inside the badge's edge. */
export const BADGE_DISC = { center: 8, radius: 7.5, rim: 1 } as const;

/** The glyph's own square, centered on the disc. */
export const BADGE_GLYPH = { x: 2.5, y: 2.5, size: 11 } as const;
