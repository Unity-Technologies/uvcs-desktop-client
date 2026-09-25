export interface Point {
  x: number;
  y: number;
}

/** A cubic Bézier: start, two control points, end. */
export type Curve = [Point, Point, Point, Point];

/** The S-shaped curve used for merge links and branch starts, flowing left to right. */
export function linkCurve(from: Point, to: Point): Curve {
  const bend = Math.max(Math.abs(to.x - from.x) * 0.5, 24);
  return [from, { x: from.x + bend, y: from.y }, { x: to.x - bend, y: to.y }, to];
}

/** A branch leaves its base changeset downwards, then turns right into its lane. */
export function branchStartCurve(base: Point, laneStart: Point): Curve {
  const turn = Math.min(Math.abs(laneStart.y - base.y), 28);
  return [base, { x: base.x, y: base.y + turn }, { x: laneStart.x - turn, y: laneStart.y }, laneStart];
}

export function pointOnCurve([p0, p1, p2, p3]: Curve, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/** Approximate distance from a point to the curve, good enough for hit testing. */
export function distanceToCurve(curve: Curve, point: Point, samples = 24): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= samples; index++) {
    const onCurve = pointOnCurve(curve, index / samples);
    best = Math.min(best, Math.hypot(onCurve.x - point.x, onCurve.y - point.y));
  }
  return best;
}
