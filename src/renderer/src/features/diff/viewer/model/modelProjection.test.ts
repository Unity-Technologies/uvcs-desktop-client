import { describe, expect, it } from 'vitest';
import { depthOfHit, hiddenBehind, projectorOf } from './modelProjection';
import type { OrbitView } from './orbitCamera';

const BOUNDS = { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
/** From the front, level, 5 m away. */
const FRONT: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 5 };
/** A canvas 800 × 400 CSS pixels at twice the device pixels. */
const CANVAS = { width: 800, height: 400, pixelRatio: 2 };
const FULL = { x: 0, y: 0, width: 1600, height: 800 };

describe('projectorOf', () => {
  it('puts the target in the middle of the pane, at its distance', () => {
    expect(projectorOf(FRONT, BOUNDS, FULL, CANVAS)([0, 0, 0])).toEqual({ x: 400, y: 200, depth: 5 });
  });

  it('puts a point above the target higher on screen, and one to its right further right', () => {
    const above = projectorOf(FRONT, BOUNDS, FULL, CANVAS)([0, 1, 0])!;
    const right = projectorOf(FRONT, BOUNDS, FULL, CANVAS)([1, 0, 0])!;
    expect(above.y).toBeLessThan(200);
    expect(right.x).toBeGreaterThan(400);
  });

  it("places it in its version's pane: Split's right half", () => {
    const after = { x: 800, y: 0, width: 800, height: 800 };
    expect(projectorOf(FRONT, BOUNDS, after, CANVAS)([0, 0, 0])).toMatchObject({ x: 600, y: 200 });
  });

  it('places each point it is given as alone, one after another', () => {
    const project = projectorOf(FRONT, BOUNDS, FULL, CANVAS);
    const points: [number, number, number][] = [[0, 1, 0], [0, 0, 6], [1, 0, 0]];
    expect(points.map(project)).toEqual(points.map((point) => projectorOf(FRONT, BOUNDS, FULL, CANVAS)(point)));
  });

  it("shows nothing off its version's pane, where Split would draw it over the other version", () => {
    const after = { x: 800, y: 0, width: 800, height: 800 };
    // Far to the left of the target: off the right half's left edge, in the left half.
    expect(projectorOf(FRONT, BOUNDS, after, CANVAS)([-4, 0, 0])).toBeNull();
    expect(projectorOf(FRONT, BOUNDS, after, CANVAS)([0, 4, 0])).toBeNull();
  });

  it('shows nothing behind the camera', () => {
    expect(projectorOf(FRONT, BOUNDS, FULL, CANVAS)([0, 0, 6])).toBeNull();
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

describe('depthOfHit', () => {
  it('is how far the surface hit is from the camera, and none where nothing was hit', () => {
    expect(depthOfHit({ point: [0, 3, 4] }, [0, 0, 0])).toBe(5);
    expect(depthOfHit({ point: null }, [0, 0, 0])).toBeNull();
    expect(depthOfHit(null, [0, 0, 0])).toBeNull();
  });
});
