import { arrowHead } from './arrowHead';
import type { Point } from './curves';
import type { DrawContext } from './drawContext';

/** The arrowhead's length for a line's width: it reads as the line's own head at every weight. */
export function arrowLength(lineWidth: number): number {
  return 6 + 2 * lineWidth;
}

/** How far into the head the line it ends runs: inside it, never under its tip, so the tip stays sharp. */
export const LINE_INTO_HEAD = 0.5;

/**
 * The same arrowhead on every link of the graph, parent lines and merges alike: filled, its corners rounded by a thin
 * stroke of the fill, so its points stay crisp and soft at once.
 */
export function drawArrowHead({ ctx, pen }: DrawContext, tip: Point, angle: number, length: number): void {
  const [point, left, notch, right] = arrowHead(tip, angle, length);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  ctx.beginPath();
  pen.moveTo(point.x, point.y);
  pen.lineTo(left.x, left.y);
  pen.lineTo(notch.x, notch.y);
  pen.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
