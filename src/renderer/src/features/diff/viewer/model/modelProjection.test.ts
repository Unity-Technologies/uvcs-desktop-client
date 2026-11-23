import { describe, expect, it } from 'vitest';
import { hiddenBehind, projectedPoint } from './modelProjection';
import type { OrbitView } from './orbitCamera';

const BOUNDS = { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
/** From the front, level, 5 m away. */
const FRONT: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 5 };
/** A canvas 800 × 400 CSS pixels at twice the device pixels. */
const CANVAS = { width: 800, height: 400, pixelRatio: 2 };
const FULL = { x: 0, y: 0, width: 1600, height: 800 };

describe('projectedPoint', () => {
  it('puts the target in the middle of the pane, at its distance', () => {
    expect(projectedPoint([0, 0, 0], FRONT, BOUNDS, FULL, CANVAS)).toEqual({ x: 400, y: 200, depth: 5 });
  });

  it('puts a point above the target higher on screen, and one to its right further right', () => {
    const above = projectedPoint([0, 1, 0], FRONT, BOUNDS, FULL, CANVAS)!;
    const right = projectedPoint([1, 0, 0], FRONT, BOUNDS, FULL, CANVAS)!;
    expect(above.y).toBeLessThan(200);
    expect(right.x).toBeGreaterThan(400);
  });

  it("places it in its version's pane: Split's right half", () => {
    const after = { x: 800, y: 0, width: 800, height: 800 };
    expect(projectedPoint([0, 0, 0], FRONT, BOUNDS, after, CANVAS)).toMatchObject({ x: 600, y: 200 });
  });

  it('shows nothing behind the camera', () => {
    expect(projectedPoint([0, 0, 6], FRONT, BOUNDS, FULL, CANVAS)).toBeNull();
  });
});

describe('hiddenBehind', () => {
  it('is hidden behind a surface nearer than the point', () => {
    expect(hiddenBehind(5, 4, 2)).toBe(true);
  });

  it("isn't hidden by the surface it's on, read back a hair off, nor where nothing is in front", () => {
    expect(hiddenBehind(5, 4.995, 2)).toBe(false);
    expect(hiddenBehind(5, 5.01, 2)).toBe(false);
    expect(hiddenBehind(5, null, 2)).toBe(false);
  });
});
