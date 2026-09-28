import type { Point } from './curves';

/** Half the head's width, as a share of its length: a triangle a little longer than wide. */
const HALF_WIDTH = 0.42;

/** A plain triangular arrowhead from `base`, the middle of its back, to `tip`: the tip and its two back corners. */
export function arrowHead(tip: Point, base: Point): [Point, Point, Point] {
  const across = { x: (base.y - tip.y) * HALF_WIDTH, y: (tip.x - base.x) * HALF_WIDTH };
  return [tip, { x: base.x + across.x, y: base.y + across.y }, { x: base.x - across.x, y: base.y - across.y }];
}
