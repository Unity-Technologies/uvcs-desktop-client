import type { Point } from './curves';

/** How far the back of the head is notched in, as a share of its length: an arrowhead, not a triangle. */
const NOTCH = 0.28;
/** Half the head's width, as a share of its length. */
const HALF_WIDTH = 0.46;

/**
 * An arrowhead with its tip at `tip`, pointing along `angle`: the tip, its two back corners and the notch between
 * them, in drawing order.
 */
export function arrowHead(tip: Point, angle: number, length: number): [Point, Point, Point, Point] {
  const along = { x: Math.cos(angle), y: Math.sin(angle) };
  const across = { x: -along.y, y: along.x };
  const back = { x: tip.x - along.x * length, y: tip.y - along.y * length };
  const half = length * HALF_WIDTH;
  return [
    tip,
    { x: back.x + across.x * half, y: back.y + across.y * half },
    { x: tip.x - along.x * length * (1 - NOTCH), y: tip.y - along.y * length * (1 - NOTCH) },
    { x: back.x - across.x * half, y: back.y - across.y * half },
  ];
}
