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

/** How far back from the end the search for where a curve arrives steps, before narrowing down. */
const ARRIVAL_STEP = 1 / 32;

/**
 * Where the curve comes within `distance` of its end, the last time along it. An arrow between two such points sits on
 * the line where it disappears behind the changeset it points at, aligned with it, instead of along the curve's hidden
 * last stretch (flat, while a link can arrive from far below).
 */
export function arrivalAt(curve: Curve, distance: number): Point & { t: number } {
  let inside = 1;
  let outside = 0;
  for (let t = 1 - ARRIVAL_STEP; t > 0; t -= ARRIVAL_STEP) {
    if (distanceFromEnd(curve, t) >= distance) {
      outside = t;
      break;
    }
    inside = t;
  }
  for (let step = 0; step < 24; step++) {
    const middle = (inside + outside) / 2;
    if (distanceFromEnd(curve, middle) >= distance) outside = middle;
    else inside = middle;
  }
  const t = (inside + outside) / 2;
  return { ...pointOnCurve(curve, t), t };
}

/** The part of the curve from its start to `t` (de Casteljau), to stroke a link only up to its arrowhead. */
export function curveUntil([p0, p1, p2, p3]: Curve, t: number): Curve {
  const lerp = (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const p01 = lerp(p0, p1);
  const p12 = lerp(p1, p2);
  const p012 = lerp(p01, p12);
  const p123 = lerp(p12, lerp(p2, p3));
  return [p0, p01, p012, lerp(p012, p123)];
}

/** How far the point at `t` is from the curve's end; allocates nothing, as the arrows ask it often in every frame. */
function distanceFromEnd([p0, p1, p2, p3]: Curve, t: number): number {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return Math.hypot(a * p0.x + b * p1.x + c * p2.x + d * p3.x - p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y - p3.y);
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
