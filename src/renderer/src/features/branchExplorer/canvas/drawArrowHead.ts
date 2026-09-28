import { arrowHead } from './arrowHead';
import type { Point } from './curves';
import type { DrawContext } from './drawContext';

/** The arrowhead's length for a line's width: compact beside the line, yet its own head at every weight. */
export function arrowLength(lineWidth: number): number {
  return 3 + 3.25 * lineWidth;
}

/**
 * How far the line runs past the head's base, under it: a quarter of a device pixel, which closes the light seam two
 * antialiased edges meeting there leave, without the darker band a longer overlap shows through a translucent link.
 */
export function lineUnderHead({ pixelRatio, scene }: DrawContext): number {
  return 0.25 / (pixelRatio * scene.viewport.zoom);
}

/**
 * The same arrowhead on every link of the graph, parent lines and merges alike: a solid triangle, filled only so its
 * corners stay crisp. The line it ends meets `base`, the middle of its back.
 */
export function drawArrowHead({ ctx, pen }: DrawContext, tip: Point, base: Point): void {
  const [point, left, right] = arrowHead(tip, base);
  ctx.beginPath();
  pen.moveTo(point.x, point.y);
  pen.lineTo(left.x, left.y);
  pen.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();
}
