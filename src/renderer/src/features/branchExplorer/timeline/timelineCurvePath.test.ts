import { describe, expect, it } from 'vitest';
import { SHARE_MIN_HEIGHT, type ActivityCurve } from './activityCurve';
import { BASELINE, PLOT_HEIGHT, PLOT_TOP } from './timelineGeometry';
import { CURVE_STEP, sampledCurve, smoothPath, timelineCurves } from './timelineCurvePath';

const curveOf = (total: number[], share: number[] = total.map(() => 0), present: number[] = total.map(() => 0)): ActivityCurve => ({
  total: Float64Array.from(total),
  share: Float64Array.from(share),
  sharePresent: Uint8Array.from(present),
});

describe('sampledCurve', () => {
  it('samples a point every step, the last pixel included, at its height above the baseline', () => {
    const points = sampledCurve(8, 3, (from) => from);
    expect(points).toEqual([
      { x: 0, y: BASELINE },
      { x: 3, y: BASELINE - 3 },
      { x: 6, y: BASELINE - 6 },
      { x: 7, y: BASELINE - 7 },
    ]);
    expect(sampledCurve(0, 3, () => 1)).toEqual([]);
  });
});

describe('smoothPath', () => {
  it('joins the points with Catmull-Rom control points, through every point', () => {
    const points = [
      { x: 0, y: 30 },
      { x: 3, y: 20 },
      { x: 6, y: 30 },
    ];
    const path = smoothPath(points);
    expect(path.start).toEqual(points[0]);
    expect(path.segments.map(({ end }) => end)).toEqual([points[1], points[2]]);
    // p1 + (p2 − p0) / 6, with p0 = p1 at the start; p2 − (p3 − p1) / 6, with p3 = p2 at the end.
    expect(path.segments[0]!.c1).toEqual({ x: 0.5, y: 30 - 10 / 6 });
    expect(path.segments[0]!.c2).toEqual({ x: 2, y: 20 });
    expect(path.segments[1]!.c2).toEqual({ x: 5.5, y: 30 - 10 / 6 });
  });

  it('keeps the control points within the plot: never under the baseline, never far over the top', () => {
    const path = smoothPath([
      { x: 0, y: BASELINE },
      { x: 3, y: BASELINE },
      { x: 6, y: PLOT_TOP },
      { x: 9, y: BASELINE },
      { x: 12, y: BASELINE },
    ]);
    for (const { c1, c2 } of path.segments) {
      for (const y of [c1.y, c2.y]) {
        expect(y).toBeLessThanOrEqual(BASELINE);
        expect(y).toBeGreaterThanOrEqual(PLOT_TOP - 2);
      }
    }
  });
});

describe('timelineCurves', () => {
  it('stands the curve on the baseline at its heights', () => {
    const curves = timelineCurves(curveOf([0, 0, 0, 1, 1, 1, 0.5]));
    expect(curves.total.start).toEqual({ x: 0, y: BASELINE });
    expect(curves.total.segments.map(({ end }) => end)).toEqual([
      { x: 3, y: BASELINE - PLOT_HEIGHT },
      { x: 6, y: BASELINE - PLOT_HEIGHT / 2 },
    ]);
  });

  it("keeps the share's floor where the user's one changeset falls between two points", () => {
    const width = 10;
    const present = Array.from({ length: width }, (_, pixel) => (pixel === 4 ? 1 : 0));
    const curves = timelineCurves(curveOf(Array(width).fill(0.5), Array(width).fill(0), present), CURVE_STEP);
    const tallest = Math.max(BASELINE - curves.share.start.y, ...curves.share.segments.map(({ end }) => BASELINE - end.y));
    expect(tallest).toBe(SHARE_MIN_HEIGHT);
  });

  it('never stands the share above the curve where it is all of the activity, on a rising slope too', () => {
    const ramp = Array.from({ length: 30 }, (_, pixel) => pixel / 29);
    const curves = timelineCurves(curveOf(ramp, ramp, ramp.map(() => 1)));
    const points = (path: typeof curves.total) => [path.start, ...path.segments.map(({ end }) => end)];
    const share = points(curves.share);
    points(curves.total).forEach((point, index) => expect(share[index]!.y).toBeGreaterThanOrEqual(Math.min(point.y, BASELINE - SHARE_MIN_HEIGHT)));
  });
});
