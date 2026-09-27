import { describe, expect, it } from 'vitest';
import { arrivalAt, curveUntil, distanceToCurve, linkCurve, pointOnCurve } from './curves';

describe('arrivalAt', () => {
  it('finds the point that far back along a straight link, pointing along it', () => {
    const arrival = arrivalAt(linkCurve({ x: 0, y: 0 }, { x: 100, y: 0 }), 15);
    expect(arrival.x).toBeCloseTo(85, 6);
    expect(arrival.y).toBeCloseTo(0, 6);
    expect(arrival.angle).toBeCloseTo(0, 6);
  });

  it('stays on a link arriving from far below, aligned with it there rather than with its flat end', () => {
    const curve = linkCurve({ x: 0, y: 300 }, { x: 60, y: 0 });
    const arrival = arrivalAt(curve, 15);
    expect(Math.hypot(arrival.x - 60, arrival.y)).toBeCloseTo(15, 6);
    expect(distanceToCurve(curve, arrival, 4000)).toBeLessThan(0.05);
    // Still rising where it meets the changeset (up is negative y), while the curve's own last tangent is flat.
    expect(arrival.angle).toBeLessThan(-0.3);
    expect(arrival.angle).toBeGreaterThan(-Math.PI / 2);
  });
});

describe('curveUntil', () => {
  it('is the curve up to t, ending on the curve where t lands', () => {
    const curve = linkCurve({ x: 0, y: 300 }, { x: 60, y: 0 });
    const part = curveUntil(curve, 0.8);
    expect(part[0]).toEqual(curve[0]);
    expect(part[3].x).toBeCloseTo(pointOnCurve(curve, 0.8).x, 9);
    expect(part[3].y).toBeCloseTo(pointOnCurve(curve, 0.8).y, 9);
    expect(distanceToCurve(curve, pointOnCurve(part, 0.5), 4000)).toBeLessThan(0.05);
  });
});
