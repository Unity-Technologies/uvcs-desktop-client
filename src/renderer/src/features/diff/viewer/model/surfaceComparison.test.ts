import { describe, expect, it } from 'vitest';
import { changeShares, compareSurfaces, placedMeshesOf, type PlacedMeshes } from './surfaceComparison';
import { boundAtOrigin, testModel, type TestNode } from './testing/testModels';

const placed = (nodes: TestNode[], unitScale = 1) => placedMeshesOf(testModel({ nodes, unitScale }));
/** A grid of `count` crates, every tenth lifted by `lift`: a scene of many small meshes, as a level or a kit is. */
const crates = (count: number, lift = 0) =>
  placed(Array.from({ length: count }, (_, i) => ({ name: `Crate ${i}`, position: [(i % 10) * 2, i % 10 === 0 ? lift : 0, Math.floor(i / 10) * 2] as [number, number, number], mesh: {} })));
/** The same meshes drawn as one: their triangles' corners one after the other. */
const asOneMesh = ({ meshes }: PlacedMeshes): PlacedMeshes => {
  const corners = meshes.flatMap(({ positions, index }) => (index ? [...index].flatMap((vertex) => [...positions.subarray(vertex * 3, vertex * 3 + 3)]) : [...positions]));
  return { meshes: [{ positions: new Float32Array(corners), index: null }] };
};
const concatenated = (meshes: Float32Array[]): number[] => meshes.flatMap((mesh) => [...mesh]);
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

  it('measures each mesh as it measures the model drawn as one mesh', () => {
    const before = crates(30);
    const after = crates(30, 0.5);
    const byMesh = compareSurfaces(before, after);
    const whole = compareSurfaces(asOneMesh(before), asOneMesh(after));
    expect(concatenated(byMesh.after)).toEqual(concatenated(whole.after));
    expect(concatenated(byMesh.before)).toEqual(concatenated(whole.before));
    expect(Math.max(...concatenated(byMesh.after))).toBeCloseTo(0.5, 5);
  });

  it('tells what nothing is near as a tenth of the model', () => {
    const before = placed([{ name: 'Rock', mesh: {} }]);
    const after = placed([{ name: 'Rock', mesh: {} }, { name: 'Far', position: [50, 0, 0], mesh: {} }]);
    const comparison = compareSurfaces(before, after);
    expect(comparison.maxDistance).toBeCloseTo(comparison.size * 0.1);
    expect(maxOf([comparison.after[1]!])).toBeCloseTo(comparison.maxDistance);
  });
});

describe('placedMeshesOf', () => {
  it('places a skinned mesh where its bones hold it at rest, as it is drawn', () => {
    // A halberd 2 m long bound upright, held across by an arm turned 90° about Z: it lies along -X.
    const held = boundAtOrigin(testModel({ nodes: [{ name: 'Arm', kind: 'bone', rotation: [0, 0, 90] }, { name: 'Halberd', mesh: { size: [0.2, 2, 0.2], center: [0, 1, 0], bones: ['Arm'] } }] }));
    const [halberd] = placedMeshesOf(held).meshes;
    const xs = halberd!.positions.filter((_, i) => i % 3 === 0);
    const ys = halberd!.positions.filter((_, i) => i % 3 === 1);
    expect([Math.min(...xs), Math.max(...xs)].map((x) => x + 0)).toEqual([expect.closeTo(-2), expect.closeTo(0)]);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([expect.closeTo(-0.1), expect.closeTo(0.1)]);
  });
});

describe('changeShares', () => {
  it('tells how much of each version moved past the tolerance, and the farthest', () => {
    const comparison = { before: [new Float32Array([0, 0, 0.3, 0])], after: [new Float32Array([0, 0.5])], size: 10, maxDistance: 1 };
    expect(changeShares(comparison, 0.1)).toEqual({ moved: 0.5, gone: 0.25, farthest: 0.5 });
  });
});
