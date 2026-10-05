import { describe, expect, it } from 'vitest';
import { changeShares, compareSurfaces, placedMeshesOf } from './surfaceComparison';
import { testModel, type TestNode } from './testing/testModels';

const placed = (nodes: TestNode[], unitScale = 1) => placedMeshesOf(testModel({ nodes, unitScale }));
const maxOf = (distances: Float32Array[]): number => Math.max(...distances.map((mesh) => Math.max(...mesh)));

describe('compareSurfaces', () => {
  it('measures nothing for the same model, whoever holds its meshes', () => {
    const one = placed([{ name: 'Crate', mesh: { size: [1, 1, 1] } }]);
    const split = placed([{ name: 'Crate', position: [0, 0, 0], mesh: { size: [1, 1, 1] } }]);
    const comparison = compareSurfaces(one, split);
    expect(maxOf(comparison.after)).toBe(0);
    expect(maxOf(comparison.before)).toBe(0);
  });

  it('measures a moved part on both sides: where it is now, and where it was', () => {
    const before = placed([{ name: 'Body', mesh: {} }, { name: 'Lid', position: [0, 1, 0], mesh: { size: [1, 0.1, 1] } }]);
    const after = placed([{ name: 'Body', mesh: {} }, { name: 'Lid', position: [0, 1.2, 0], mesh: { size: [1, 0.1, 1] } }]);
    const comparison = compareSurfaces(before, after);
    expect(maxOf([comparison.after[0]!])).toBe(0);
    expect(maxOf([comparison.after[1]!])).toBeCloseTo(0.2, 5);
    expect(maxOf([comparison.before[1]!])).toBeGreaterThan(0.1);
  });

  it('compares in metres, in the space the models are placed in', () => {
    const before = placed([{ name: 'Rock', mesh: { size: [100, 100, 100] } }], 0.01);
    const after = placed([{ name: 'Rock', position: [10, 0, 0], mesh: { size: [100, 100, 100] } }], 0.01);
    expect(maxOf(compareSurfaces(before, after).after)).toBeCloseTo(0.1, 5);
  });

  it('tells what nothing is near as a tenth of the model', () => {
    const before = placed([{ name: 'Rock', mesh: {} }]);
    const after = placed([{ name: 'Rock', mesh: {} }, { name: 'Far', position: [50, 0, 0], mesh: {} }]);
    const comparison = compareSurfaces(before, after);
    expect(comparison.maxDistance).toBeCloseTo(comparison.size * 0.1);
    expect(maxOf([comparison.after[1]!])).toBeCloseTo(comparison.maxDistance);
  });
});

describe('changeShares', () => {
  it('tells how much of each version moved past the tolerance, and the farthest', () => {
    const comparison = { before: [new Float32Array([0, 0, 0.3, 0])], after: [new Float32Array([0, 0.5])], size: 10, maxDistance: 1 };
    expect(changeShares(comparison, 0.1)).toEqual({ moved: 0.5, gone: 0.25, farthest: 0.5 });
  });
});
