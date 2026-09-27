import { describe, expect, it } from 'vitest';
import { arrowHead } from './arrowHead';

describe('arrowHead', () => {
  it('points along the angle, its back corners either side and its notch between them', () => {
    const [tip, left, notch, right] = arrowHead({ x: 100, y: 50 }, 0, 10);
    expect(tip).toEqual({ x: 100, y: 50 });
    expect(left.x).toBeCloseTo(90, 6);
    expect(right.x).toBeCloseTo(90, 6);
    expect(left.y - 50).toBeCloseTo(-(right.y - 50), 6);
    expect(Math.abs(left.y - right.y)).toBeCloseTo(9.2, 6);
    expect(notch.x).toBeGreaterThan(90);
    expect(notch.x).toBeLessThan(100);
    expect(notch.y).toBeCloseTo(50, 6);
  });

  it('turns with the link it ends', () => {
    const [tip, , notch] = arrowHead({ x: 0, y: 0 }, -Math.PI / 2, 10);
    expect(tip).toEqual({ x: 0, y: 0 });
    expect(notch.x).toBeCloseTo(0, 6);
    expect(notch.y).toBeGreaterThan(0);
  });
});
