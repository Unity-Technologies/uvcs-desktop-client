import { describe, expect, it } from 'vitest';
import { modelSummary, type Bounds } from './modelSummary';
import { boundAtOrigin, testModel } from './testing/testModels';

const rounded = (bounds: Bounds | null): Bounds | null =>
  bounds && { min: bounds.min.map((v) => Number(v.toFixed(4)) + 0) as Bounds['min'], max: bounds.max.map((v) => Number(v.toFixed(4)) + 0) as Bounds['max'] };

describe('modelSummary', () => {
  it('names nodes by their path under the model, as transform.Find and animations do', () => {
    const summary = modelSummary(
      testModel({
        nodes: [
          { name: 'Armature' },
          { name: 'Hips', parent: 'Armature', kind: 'bone' },
          { name: 'Spine', parent: 'Hips', kind: 'bone' },
        ],
      }),
    );
    expect(summary.nodes.map((node) => node.path)).toEqual(['', 'Armature', 'Armature/Hips', 'Armature/Hips/Spine']);
    expect(summary.totals.bones).toBe(2);
  });

  it('tells apart siblings that share a name', () => {
    const summary = modelSummary(testModel({ nodes: [{ name: 'Wheel', mesh: {} }, { name: 'Wheel', mesh: {} }, { name: 'Wheel', mesh: {} }] }));
    expect(summary.nodes.map((node) => node.key)).toEqual(['', 'Wheel', 'Wheel #2', 'Wheel #3']);
    expect(summary.nodes.map((node) => node.path)).toEqual(['', 'Wheel', 'Wheel', 'Wheel']);
  });

  it("keys a node under its parent's key, so the children of siblings of one name stay apart", () => {
    const summary = modelSummary(testModel({ nodes: [{ name: 'Wheel' }, { name: 'Bolt', parent: 'Wheel', mesh: {} }] }));
    const second = testModel({ nodes: [{ name: 'Wheel' }, { name: 'Wheel' }] });
    second.nodes.push({ ...second.nodes[2]!, name: 'Bolt', parent: 2 });
    expect(modelSummary(second).nodes.map((node) => node.key)).toEqual(['', 'Wheel', 'Wheel #2', 'Wheel #2/Bolt']);
    expect(modelSummary(second).nodes.map((node) => node.path)).toEqual(['', 'Wheel', 'Wheel', 'Wheel/Bolt']);
    expect(summary.nodes.map((node) => node.key)).toEqual(['', 'Wheel', 'Wheel/Bolt']);
  });

  it('counts vertices as Unity does: corners that differ in any attribute stay apart', () => {
    // A box with flat normals: each of its 8 corners belongs to 3 faces, each with its own normal.
    expect(modelSummary(testModel({ nodes: [{ name: 'Crate', mesh: {} }] })).meshes[0]).toMatchObject({ triangles: 12, vertices: 24 });
    // Without normals or UVs, the corners weld to the box's 8.
    expect(modelSummary(testModel({ nodes: [{ name: 'Crate', mesh: { normals: false } }] })).meshes[0]).toMatchObject({ triangles: 12, vertices: 8 });
  });

  it('measures the model in metres, as Unity imports its units', () => {
    const crate = testModel({ unitScale: 0.01, nodes: [{ name: 'Crate', position: [0, 50, 0], mesh: { size: [100, 100, 100] } }] });
    expect(rounded(modelSummary(crate).bounds)).toEqual({ min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] });
  });

  it('mirrors X, as Unity turns a right-handed file left-handed', () => {
    const offset = testModel({ nodes: [{ name: 'Lamp', position: [2, 0, 0], mesh: {} }] });
    expect(rounded(modelSummary(offset).bounds)).toEqual({ min: [-2.5, -0.5, -0.5], max: [-1.5, 0.5, 0.5] });
  });

  it('stands a Z-up file on Y', () => {
    const tower = testModel({ upAxis: 'z', nodes: [{ name: 'Tower', mesh: { size: [1, 1, 10], center: [0, 0, 5] } }] });
    expect(rounded(modelSummary(tower).bounds)).toEqual({ min: [-0.5, 0, -0.5], max: [0.5, 10, 0.5] });
  });

  it('measures a skinned mesh where its bones hold it at rest, as it is drawn', () => {
    // A halberd 2 m long bound upright, held across by an arm turned 90° about Z: it lies along -X, mirrored to +X.
    const held = boundAtOrigin(testModel({ nodes: [{ name: 'Arm', kind: 'bone', rotation: [0, 0, 90] }, { name: 'Halberd', mesh: { size: [0.2, 2, 0.2], center: [0, 1, 0], bones: ['Arm'] } }] }));
    expect(rounded(modelSummary(held).bounds)).toEqual({ min: [0, -0.1, -0.1], max: [2, 0.1, 0.1] });
  });

  it('bounds each node with everything under it', () => {
    const summary = modelSummary(testModel({ nodes: [{ name: 'Car' }, { name: 'Wheel', parent: 'Car', position: [3, 0, 0], mesh: {} }] }));
    expect(rounded(summary.nodes[1]!.bounds)).toEqual({ min: [-3.5, -0.5, -0.5], max: [-2.5, 0.5, 0.5] });
    expect(summary.nodes[1]!.mesh).toBeNull();
    expect(summary.nodes[2]!.mesh).toBe(0);
  });

  it('totals what a budget counts', () => {
    const summary = modelSummary(
      testModel({
        nodes: [
          { name: 'Body', mesh: { slots: ['Skin', 'Cloth'], blendShapes: ['Smile', 'Blink'] } },
          { name: 'Hat', mesh: { slots: ['Cloth'] } },
        ],
        clips: [{ name: 'Idle', duration: 2 }],
      }),
    );
    expect(summary.totals).toEqual({ triangles: 24, vertices: 48, meshes: 2, materials: 2, bones: 0, blendShapes: 2 });
    expect(summary.clips).toEqual([{ name: 'Idle', duration: 2 }]);
  });

  it('keeps only the material slots some triangle uses, as Unity makes submeshes only of those', () => {
    const model = testModel({ nodes: [{ name: 'Car', mesh: { slots: ['Paint', 'Glass'] } }] });
    model.meshes[0]!.slots.push('Unused');
    model.meshes[0]!.groups.push({ start: 36, count: 0, slot: 2 });
    const summary = modelSummary(model);
    expect(summary.meshes[0]!.slots).toEqual(['Paint', 'Glass']);
    expect(summary.totals.materials).toBe(2);
  });

  it('fingerprints each attribute, equal for equal data and different for any change', () => {
    const before = modelSummary(testModel({ nodes: [{ name: 'Rock', mesh: { uv: true } }] })).meshes[0]!;
    const same = modelSummary(testModel({ nodes: [{ name: 'Rock', mesh: { uv: true } }] })).meshes[0]!;
    const bigger = modelSummary(testModel({ nodes: [{ name: 'Rock', mesh: { uv: true, size: [2, 1, 1] } }] })).meshes[0]!;
    expect(same.fingerprints).toEqual(before.fingerprints);
    expect(bigger.fingerprints.positions).not.toBe(before.fingerprints.positions);
    expect(bigger.fingerprints.uv).toBe(before.fingerprints.uv);
  });
});
