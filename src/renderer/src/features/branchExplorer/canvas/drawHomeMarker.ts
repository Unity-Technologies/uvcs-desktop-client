import type { Point } from './curves';
import type { DrawContext } from './drawContext';
import type { GraphPalette } from './graphPalette';
import { strokeHouse } from './houseGlyph';

/**
 * "You are here": a small house pinned to the shoulder of the workspace changeset (or of its pending changes), a badge rather than a ring so it never
 * looks like the selection. Like a map pin it is drawn at screen size with a floor and a ceiling: findable zoomed far
 * out, never ballooning zoomed in. Once it would outgrow the changeset it marks, it becomes the changeset: a solid dot.
 */
export function drawHomeMarker({ ctx, scene, pixelRatio }: DrawContext, center: Point, nodeRadius: number): void {
  const { viewport, palette } = scene;
  const radius = Math.min(10, Math.max(4, 8 * viewport.zoom));
  const nodeScreenRadius = nodeRadius * viewport.zoom;
  const x = center.x * viewport.zoom + viewport.panX;
  const y = center.y * viewport.zoom + viewport.panY;

  ctx.save();
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (radius >= nodeScreenRadius * 1.4) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3.5, nodeScreenRadius + 1.5), 0, Math.PI * 2);
    ctx.fillStyle = palette.accent;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.background;
    ctx.stroke();
    ctx.restore();
    return;
  }

  // On the shoulder, snapped to the half-pixel grid so the symmetric glyph rasterizes symmetric.
  const snap = (value: number): number => Math.round(value * pixelRatio * 2) / (pixelRatio * 2);
  const shoulder = nodeScreenRadius * 0.8 + 2;
  drawHomeBadge(ctx, snap(x + shoulder), snap(y - shoulder), radius, palette);
  ctx.restore();
}

/** The shadow that lifts a home badge drawn over a busy backdrop (`HomeBadgeStyle.shadow`): blur and drop, in px. */
export const HOME_BADGE_SHADOW = { blur: 3, offsetY: 1 };

/** The width of a home badge's ring, by its radius. */
export function homeBadgeRing(radius: number): number {
  return Math.max(1, radius * 0.2);
}

/** How the home badge is drawn beyond the graph's: dashed for pending changes, lifted by a shadow over a busy backdrop. */
export interface HomeBadgeStyle {
  dashed?: boolean;
  shadow?: boolean;
}

/**
 * The home badge, centered on (x, y) in screen px: a raised disc ringed in the accent with the house glyph in it (from
 * `radius` 5.5 up). One mark for "you are here", on the graph and on the Timeline.
 */
export function drawHomeBadge(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, palette: GraphPalette, { dashed = false, shadow = false }: HomeBadgeStyle = {}): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = palette.surfaceRaised;
  if (shadow) {
    ctx.shadowColor = palette.badgeShadow;
    ctx.shadowBlur = HOME_BADGE_SHADOW.blur;
    ctx.shadowOffsetY = HOME_BADGE_SHADOW.offsetY;
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = homeBadgeRing(radius);
  ctx.strokeStyle = palette.accent;
  if (dashed) ctx.setLineDash([2.5, 2]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (radius >= 5.5) strokeHouse(ctx, x, y, radius / 13, palette.accent, Math.max(1.1, (1.7 * radius) / 13));
  ctx.restore();
}
