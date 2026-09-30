import { describe, expect, it } from 'vitest';
import { arrivalAt, curveUntil, distanceToCurve, linkCurve, pendingParentCurve, pointOnCurve } from './curves';

describe('arrivalAt', () => {
  it('finds the point that far back along a straight link', () => {
    const arrival = arrivalAt(linkCurve({ x: 0, y: 0 }, { x: 100, y: 0 }), 15);
    expect(arrival.x).toBeCloseTo(85, 6);
    expect(arrival.y).toBeCloseTo(0, 6);
  });

  it('stays on a link arriving from far below, so an arrow between two arrivals rises with it rather than lying flat', () => {
    const curve = linkCurve({ x: 0, y: 300 }, { x: 60, y: 0 });
    const arrival = arrivalAt(curve, 15);
    expect(Math.hypot(arrival.x - 60, arrival.y)).toBeCloseTo(15, 6);
    expect(distanceToCurve(curve, arrival, 4000)).toBeLessThan(0.05);
    // Still rising where it meets the changeset (up is negative y), while the curve's own last tangent is flat.
    const before = arrivalAt(curve, 25);
    const angle = Math.atan2(arrival.y - before.y, arrival.x - before.x);
    expect(angle).toBeLessThan(-0.3);
    expect(angle).toBeGreaterThan(-Math.PI / 2);
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

describe('distanceToCurve', () => {
  it('measures to the line itself, however long the curve', () => {
    const curve = linkCurve({ x: 0, y: 0 }, { x: 6400, y: 118 });
    for (let t = 0; t <= 1; t += 0.01) {
      const onLine = pointOnCurve(curve, t);
      expect(distanceToCurve(curve, onLine)).toBeLessThan(0.5);
      expect(distanceToCurve(curve, { x: onLine.x, y: onLine.y - 10 })).toBeGreaterThan(5);
    }
  });

  it('measures past its ends to the end itself, and to a point for a link of no length', () => {
    const straight = linkCurve({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(distanceToCurve(straight, { x: -30, y: 40 })).toBeCloseTo(50, 6);
    expect(distanceToCurve(straight, { x: 130, y: 0 })).toBeCloseTo(30, 6);
    const dot = { x: 5, y: 5 };
    expect(distanceToCurve([dot, dot, dot, dot], { x: 8, y: 9 })).toBeCloseTo(5, 6);
  });

  it('measures to the arch over newer changesets, not the band under it', () => {
    const arch = pendingParentCurve({ x: 0, y: 100 }, { x: 400, y: 100 }, true);
    expect(distanceToCurve(arch, { x: 200, y: 100 })).toBeGreaterThan(20);
    expect(distanceToCurve(pendingParentCurve({ x: 0, y: 100 }, { x: 400, y: 100 }, false), { x: 200, y: 100 })).toBeCloseTo(0, 6);
  });
});
