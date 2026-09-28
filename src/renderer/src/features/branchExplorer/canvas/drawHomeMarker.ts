import type { Point } from './curves';
import type { DrawContext } from './drawContext';
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
  const badgeX = snap(x + shoulder);
  const badgeY = snap(y - shoulder);
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, radius, 0, Math.PI * 2);
  ctx.fillStyle = palette.surfaceRaised;
  ctx.fill();
  ctx.lineWidth = Math.max(1, radius * 0.2);
  ctx.strokeStyle = palette.accent;
  ctx.stroke();
  if (radius >= 5.5) strokeHouse(ctx, badgeX, badgeY, radius / 13, palette.accent, Math.max(1.1, (1.7 * radius) / 13));
  ctx.restore();
}
