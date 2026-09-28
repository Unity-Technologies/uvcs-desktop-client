import { describe, expect, it } from 'vitest';
import { arrowHead } from './arrowHead';

describe('arrowHead', () => {
  it('is a triangle from its tip back to two corners either side of the middle of its base', () => {
    const [tip, left, right] = arrowHead({ x: 100, y: 50 }, { x: 90, y: 50 });
    expect(tip).toEqual({ x: 100, y: 50 });
    expect(left.x).toBeCloseTo(90, 6);
    expect(right.x).toBeCloseTo(90, 6);
    expect((left.y + right.y) / 2).toBeCloseTo(50, 6);
  });

  it('is isosceles and a little longer than wide', () => {
    const [tip, left, right] = arrowHead({ x: 3, y: 4 }, { x: -3, y: -4 });
    expect(Math.hypot(left.x - tip.x, left.y - tip.y)).toBeCloseTo(Math.hypot(right.x - tip.x, right.y - tip.y), 6);
    const width = Math.hypot(left.x - right.x, left.y - right.y);
    expect(width).toBeLessThan(10);
    expect(width).toBeGreaterThan(7.5);
  });

  it('turns with the link it ends', () => {
    const [, left, right] = arrowHead({ x: 0, y: 0 }, { x: 0, y: 10 });
    expect(left.y).toBeCloseTo(10, 6);
    expect(right.y).toBeCloseTo(10, 6);
    expect((left.x + right.x) / 2).toBeCloseTo(0, 6);
  });
});
