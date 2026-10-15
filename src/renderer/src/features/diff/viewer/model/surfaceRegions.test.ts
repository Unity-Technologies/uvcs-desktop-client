import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { changedRegions, MAX_REGIONS, NearRegions } from './surfaceRegions';

/** A strip of `count` quads along X, `spacing` apart, two triangles each, non-indexed as FBX stores them. */
function strip(count: number, spacing: number, distanceAt: (x: number) => number, x0 = 0) {
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    const [a, b] = [x0 + i * spacing, x0 + (i + 1) * spacing];
    positions.push(a, 0, 0, b, 0, 0, b, 1, 0, a, 0, 0, b, 1, 0, a, 1, 0);
  }
  const distances = Array.from({ length: positions.length / 3 }, (_, v) => distanceAt(positions[v * 3]!));
  return { positions: new Float32Array(positions), index: null, distances: new Float32Array(distances) };
}

const rounded = (regions: { min: number[]; max: number[]; vertices: number }[]) =>
  regions.map(({ min, max, vertices }) => ({ min: min.map((v) => Number(v.toFixed(4))), max: max.map((v) => Number(v.toFixed(4))), vertices }));

describe('changedRegions', () => {
  it('joins a changed patch through its triangles, however far apart its vertices are', () => {
    // Vertices 2 m apart (a coarse mesh), the middle third changed: one region.
    const regions = changedRegions([strip(9, 2, (x) => (x >= 6 && x <= 12 ? 1 : 0))], 0.5, 20);
    expect(rounded(regions)).toEqual([{ min: [6, 0, 0], max: [12, 1, 0], vertices: 24 }]);
  });

  it('keeps patches that are apart as regions of their own, biggest first', () => {
    const regions = changedRegions([strip(20, 1, (x) => (x <= 2 || (x >= 15 && x <= 16) ? 1 : 0))], 0.5, 20);
    expect(rounded(regions).map((region) => [region.min[0], region.max[0]])).toEqual([
      [0, 2],
      [15, 16],
    ]);
  });

  it('merges what went from the version before with what came to the version after in the same place', () => {
    const before = strip(2, 1, () => 1, 0);
    const after = strip(2, 1, () => 1, 1.5);
    expect(rounded(changedRegions([before, after], 0, 20))).toEqual([{ min: [0, 0, 0], max: [3.5, 1, 0], vertices: 24 }]);
  });

  it('finds no region where nothing moved past the tolerance', () => {
    expect(changedRegions([strip(3, 1, () => 0.1)], 0.1, 10)).toEqual([]);
  });

  it('keeps the biggest regions only, when the whole model changed', () => {
    const patches = Array.from({ length: 50 }, (_, i) => strip(1, 1, () => 1, i * 10));
    expect(changedRegions(patches, 0, 100)).toHaveLength(MAX_REGIONS);
  });
});

describe('NearRegions', () => {
  const box = (min: [number, number, number], max: [number, number, number], vertices = 1) => ({ min, max, vertices });

  it('merges a region that only the box of two merged ones comes near', () => {
    // B is near A; C is near neither, but near the box of A and B together.
    const a = box([0, 0, 0], [1, 1, 0]);
    const b = box([0.5, 1.02, 0], [1.5, 2, 0]);
    const c = box([1.52, 0.5, 0], [3, 0.6, 0]);
    expect(new NearRegions(0.05).merged([c, a, b])).toEqual([box([0, 0, 0], [3, 2, 0], 3)]);
  });

  it('keeps apart regions no box comes near', () => {
    const regions = new NearRegions(0.05).merged([box([0, 0, 0], [1, 1, 0]), box([0, 3, 0], [1, 4, 0])]);
    expect(regions).toHaveLength(2);
  });

  // Merging pair by pair, starting over after each merge, compared millions of pairs for a few thousand patches.
  it('compares only the boxes that overlap along X: a few per patch, apart or in a chain', () => {
    const apart = Array.from({ length: 3000 }, (_, i) => box([i * 10, 0, 0], [i * 10 + 1, 1, 0]));
    const chain = Array.from({ length: 3000 }, (_, i) => box([i, 0, 0], [i + 0.99, 1, 0]));
    const { result: separate, calls: comparedApart } = countCalls(NearRegions.prototype, 'isNear', () => new NearRegions(0.05).merged(apart));
    const { result: joined, calls: comparedInChain } = countCalls(NearRegions.prototype, 'isNear', () => new NearRegions(0.05).merged(chain));
    expect([separate.length, joined.length]).toEqual([3000, 1]);
    expect(comparedApart).toBe(0);
    expect(comparedInChain).toBeLessThan(3 * 3000);
  });
});
