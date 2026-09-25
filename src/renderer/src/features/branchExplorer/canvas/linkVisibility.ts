import type { Point } from './curves';

/** A world-space box. */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The box around some points. For a Bézier `Curve`, the box of its control points holds the whole
 * curve however it bends (a curve never leaves the hull of its control points).
 */
export function boundsOf(points: readonly Point[]): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/**
 * Whether anything inside `bounds` (grown by `margin`, for line widths and arrow heads) can show in the
 * visible area. A link is drawn when its whole path crosses the screen, even with both ends off it.
 */
export function crossesView(bounds: Bounds, visible: Bounds, margin = 0): boolean {
  return (
    bounds.right + margin >= visible.left &&
    bounds.left - margin <= visible.right &&
    bounds.bottom + margin >= visible.top &&
    bounds.top - margin <= visible.bottom
  );
}
