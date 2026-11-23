import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { anchoredPoint, nearestSkinAnchor, skinAnchorOfSpot, skinnedMeshesOn, type PlacedMesh } from './skinAnchors';
import { testModel } from './testing/testModels';

/** Two triangles side by side on the ground: one from x 0 to 2, one from x 4 to 6. */
const GROUND: PlacedMesh = { mesh: 0, positions: new Float32Array([0, 0, 0, 2, 0, 0, 0, 0, 2, 4, 0, 0, 6, 0, 0, 4, 0, 2]), index: null };

describe('nearestSkinAnchor', () => {
  it('anchors a point on the triangle it lies on, by where in it', () => {
    const anchor = nearestSkinAnchor([GROUND], new Vector3(4.5, 0, 0.5))!;
    expect(anchor.corners).toEqual([3, 4, 5]);
    expect(anchor.weights.map((weight) => Number(weight.toFixed(6)))).toEqual([0.5, 0.25, 0.25]);
  });

  it('anchors a point off the surface where the surface comes nearest it', () => {
    const anchor = nearestSkinAnchor([GROUND], new Vector3(1, 3, -1))!;
    expect(anchor.corners).toEqual([0, 1, 2]);
    expect(anchoredPoint(anchor, [GROUND])!.toArray()).toEqual([1, 0, 0]);
  });

  it('reads triangles as an indexed mesh lists them, across every mesh given', () => {
    const indexed: PlacedMesh = { mesh: 1, positions: new Float32Array([0, 5, 0, 1, 5, 0, 0, 5, 1]), index: new Uint32Array([2, 1, 0]) };
    const anchor = nearestSkinAnchor([GROUND, indexed], new Vector3(0, 5, 0))!;
    expect(anchor).toMatchObject({ mesh: 1, corners: [2, 1, 0] });
    expect(anchoredPoint(anchor, [GROUND, indexed])!.toArray()).toEqual([0, 5, 0]);
  });

  it('passes over a triangle with no area, and anchors nothing on a mesh with no triangle', () => {
    const flat: PlacedMesh = { mesh: 0, positions: new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 1, 1, 0, 0, 2, 0]), index: null };
    expect(nearestSkinAnchor([flat], new Vector3(1, 0, 0))!.corners).toEqual([3, 4, 5]);
    expect(nearestSkinAnchor([{ mesh: 0, positions: new Float32Array(), index: null }], new Vector3())).toBeNull();
  });
});

describe('anchoredPoint', () => {
  it('is the anchor among the same vertices placed elsewhere, as a bent skin places them', () => {
    const anchor = nearestSkinAnchor([GROUND], new Vector3(4.5, 0, 0.5))!;
    const lifted: PlacedMesh = { ...GROUND, positions: GROUND.positions.map((value, i) => (i % 3 === 1 ? value + 10 : value)) };
    expect(anchoredPoint(anchor, [lifted])!.toArray().map((value) => Number(value.toFixed(6)))).toEqual([4.5, 10, 0.5]);
    expect(anchoredPoint({ ...anchor, mesh: 7 }, [lifted])).toBeNull();
  });
});

describe('skinAnchorOfSpot', () => {
  const model = testModel({
    nodes: [
      { name: 'Root', kind: 'bone' },
      { name: 'Body', kind: 'skinnedMesh', mesh: { bones: ['Root'], size: [2, 2, 2] }, position: [0, 5, 0] },
      { name: 'Crate', mesh: {} },
    ],
  });
  const body = model.nodes.findIndex((node) => node.name === 'Body');
  const crate = model.nodes.findIndex((node) => node.name === 'Crate');

  it("anchors a spot on a skinned part where its point is at rest, in the part's space", () => {
    expect(skinnedMeshesOn(model, body)).toEqual([0]);
    const anchor = skinAnchorOfSpot(model, body, { point: { x: 0, y: 6, z: 0 }, node: { path: ['Body'], local: { x: 0, y: 1, z: 0 } } })!;
    // The top of the box, 1 up from its node, which stands 5 up.
    const top = anchor.corners.map((vertex) => model.meshes[0]!.attributes.position[vertex * 3 + 1]! + 5);
    expect(top).toEqual([6, 6, 6]);
  });

  it('anchors nothing on a rigid part, or a spot that says not where on its part it is', () => {
    expect(skinnedMeshesOn(model, crate)).toEqual([]);
    expect(skinAnchorOfSpot(model, crate, { point: { x: 0, y: 0, z: 0 }, node: { path: ['Crate'], local: { x: 0, y: 0, z: 0 } } })).toBeNull();
    expect(skinAnchorOfSpot(model, body, { point: { x: 0, y: 6, z: 0 }, node: { path: ['Body'] } })).toBeNull();
  });
});
