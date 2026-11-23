import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { aimRingPass, aimRingPlacement } from './commentAim';
import type { Vector } from './orbitCamera';

const close = (vector: readonly number[]) => vector.map((value) => Number(value.toFixed(5)) + 0);
const facingOf = (quaternion: [number, number, number, number]) => close(new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...quaternion)).toArray());

describe('aimRingPlacement', () => {
  it('lies on the surface, turned to it, lifted a hair off it', () => {
    const ring = aimRingPlacement({ point: [0, 1, 0], normal: [0, 1, 0] }, [0, 1, 10], 45, 800, 14);
    expect(facingOf(ring.quaternion)).toEqual([0, 1, 0]);
    expect(ring.position[1]).toBeGreaterThan(1);
    expect(ring.position[1]).toBeLessThan(1.05);
  });

  it('is the same size on screen at any distance', () => {
    const near = aimRingPlacement({ point: [0, 0, 0], normal: [0, 0, 1] }, [0, 0, 5], 45, 800, 14);
    const far = aimRingPlacement({ point: [0, 0, 0], normal: [0, 0, 1] }, [0, 0, 50], 45, 800, 14);
    expect(far.radius / near.radius).toBeCloseTo(10);
    // 14 pixels across 800: the view's height at 5 m is 2 · 5 · tan(22.5°).
    expect(near.radius * 2).toBeCloseTo((2 * 5 * Math.tan(Math.PI / 8) * 14) / 800);
  });

  it('faces the camera where the surface’s direction isn’t known', () => {
    const camera: Vector = [3, 0, 4];
    const ring = aimRingPlacement({ point: [0, 0, 0], normal: null }, camera, 45, 800, 14);
    expect(facingOf(ring.quaternion)).toEqual([0.6, 0, 0.8]);
  });
});

describe('aimRingPass', () => {
  it('draws the ring with its version where the versions are drawn straight or blended', () => {
    expect(aimRingPass('direct')).toBe('withVersion');
    expect(aimRingPass('blended')).toBe('withVersion');
  });

  it('draws it over Diffs by look once the versions are compared, so the ring never compares as a change', () => {
    expect(aimRingPass('compared')).toBe('afterComparison');
  });
});
