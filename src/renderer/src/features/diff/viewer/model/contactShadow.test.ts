import { describe, expect, it } from 'vitest';
import { shadowFrameOf } from './contactShadow';

describe('shadowFrameOf', () => {
  it('lays the floor at the lowest point, not at the pivot: a model whose pivot is at its middle stands on it', () => {
    const pumpkin = shadowFrameOf({ min: [-0.2, -0.17, -0.21], max: [0.22, 0.17, 0.21] });
    expect(pumpkin.floor).toBe(-0.17);
  });

  it('centers the shadow under the footprint and spreads it past it, so the blur fades out inside its square', () => {
    const frame = shadowFrameOf({ min: [10, 0, -2], max: [14, 1.8, 0] });
    expect(frame.center).toEqual([12, -1]);
    expect(frame.size).toBeGreaterThan(4);
  });

  it('darkens up to the height of the model above the floor', () => {
    expect(shadowFrameOf({ min: [-1, 0.5, -1], max: [1, 2.5, 1] }).height).toBe(2);
  });

  it('keeps a size and a height for a flat or empty model', () => {
    const frame = shadowFrameOf({ min: [0, 0, 0], max: [0, 0, 0] });
    expect(frame.size).toBeGreaterThan(0);
    expect(frame.height).toBeGreaterThan(0);
  });
});
