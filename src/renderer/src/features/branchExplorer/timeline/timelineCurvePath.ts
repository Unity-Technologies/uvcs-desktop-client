import { shareHeight, type ActivityCurve } from './activityCurve';
import { BASELINE, PLOT_HEIGHT, PLOT_TOP } from './timelineGeometry';

export interface CurvePoint {
  x: number;
  y: number;
}

/** A cubic Bézier piece of a curve, from where the last one ended. */
export interface CurveSegment {
  c1: CurvePoint;
  c2: CurvePoint;
  end: CurvePoint;
}

/** A smooth curve as the canvas draws it: a start, then cubic Béziers. */
export interface CurvePath {
  start: CurvePoint;
  segments: CurveSegment[];
}

/** The curve is sampled every this many px and joined smoothly, so it reads as a line, not a staircase of pixels. */
export const CURVE_STEP = 3;

/**
 * Points every `step` px from 0 to the last pixel (always included), each at the height `heightAt` gives (px above the
 * baseline) for the pixels from it to the next point.
 */
export function sampledCurve(width: number, step: number, heightAt: (from: number, to: number) => number): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let pixel = 0; pixel < width; pixel += step) points.push({ x: pixel, y: BASELINE - heightAt(pixel, Math.min(width, pixel + step)) });
  const last = width - 1;
  if (width > 0 && points.at(-1)!.x !== last) points.push({ x: last, y: BASELINE - heightAt(last, width) });
  return points;
}

/**
 * The points joined by a Catmull-Rom spline as cubic Béziers: for the piece p1→p2 with neighbors p0 and p3, control
 * points p1 + (p2 − p0)/6 and p2 − (p3 − p1)/6, their heights kept within the plot so the curve never overshoots below
 * its baseline or far above its top.
 */
export function smoothPath(points: readonly CurvePoint[]): CurvePath {
  const keep = (y: number): number => Math.min(BASELINE, Math.max(PLOT_TOP - 2, y));
  const segments: CurveSegment[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    segments.push({
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: keep(p1.y + (p2.y - p0.y) / 6) },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: keep(p2.y - (p3.y - p1.y) / 6) },
      end: p2,
    });
  }
  return { start: points[0] ?? { x: 0, y: BASELINE }, segments };
}

/** The curve and the user's share under it, smoothed. */
export interface TimelineCurves {
  total: CurvePath;
  share: CurvePath;
}

/**
 * The activity and the share as smooth paths. The share takes the tallest of the pixels each point stands for, so its
 * floor (`SHARE_MIN_HEIGHT`, where the user has a changeset) is never stepped over.
 */
export function timelineCurves(curve: ActivityCurve, step = CURVE_STEP): TimelineCurves {
  const width = curve.total.length;
  const total = sampledCurve(width, step, (from) => curve.total[from]! * PLOT_HEIGHT);
  const share = sampledCurve(width, step, (from, to) => {
    let tallest = 0;
    for (let pixel = from; pixel < to; pixel++) tallest = Math.max(tallest, shareHeight(curve, pixel, PLOT_HEIGHT));
    return tallest;
  });
  return { total: smoothPath(total), share: smoothPath(share) };
}
