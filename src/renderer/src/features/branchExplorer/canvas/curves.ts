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

/** How far above its band the line from the loaded changeset to the pending changeset arches over newer changesets. */
const PENDING_ARCH = 30;

/**
 * The line from the loaded changeset to the pending changeset past the branch's newest: straight along the band when
 * the loaded changeset is the newest, else an arch over the band's changesets in between, so it never reads as
 * coming from the newest.
 */
export function pendingParentCurve(parent: Point, pending: Point, overChangesets: boolean): Curve {
  if (!overChangesets) return [parent, parent, pending, pending];
  const bend = Math.min(Math.abs(pending.x - parent.x) * 0.25, 48);
  return [parent, { x: parent.x + bend, y: parent.y - PENDING_ARCH }, { x: pending.x - bend, y: pending.y - PENDING_ARCH }, pending];
}

/** The same curve, run the other way. */
export function reversed([p0, p1, p2, p3]: Curve): Curve {
  return [p3, p2, p1, p0];
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

/** How long each straight piece of a curve is at most when measuring distances to it. */
const SEGMENT_LENGTH = 8;

/**
 * Distance from a point to the curve, measured to the straight pieces it is cut into, as many as its length needs:
 * a fixed number of points along a link a hundred columns long leaves most of the line too far from any of them.
 */
export function distanceToCurve(curve: Curve, point: Point, segments = segmentsFor(curve)): number {
  let best = Number.POSITIVE_INFINITY;
  let previous = curve[0];
  for (let index = 1; index <= segments; index++) {
    const next = pointOnCurve(curve, index / segments);
    best = Math.min(best, distanceToSegment(point, previous, next));
    previous = next;
  }
  return best;
}

/** Enough pieces for none to be longer than `SEGMENT_LENGTH`: the control polygon is never shorter than the curve. */
function segmentsFor([p0, p1, p2, p3]: Curve): number {
  const polygon = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y);
  return Math.max(1, Math.ceil(polygon / SEGMENT_LENGTH));
}

function distanceToSegment(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return Math.hypot(from.x + t * dx - point.x, from.y + t * dy - point.y);
}
