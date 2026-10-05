import { describe, expect, it } from 'vitest';
import { isRisk, modelChanges, type ModelChange } from './modelChanges';
import { modelSummary } from './modelSummary';
import { testModel, type TestModel, type TestNode } from './testing/testModels';

const changes = (before: TestModel, after: TestModel): ModelChange[] => modelChanges(modelSummary(testModel(before)), modelSummary(testModel(after)));
const kinds = (list: ModelChange[]): string[] => list.map((change) => change.kind);

const crate: TestNode[] = [
  { name: 'Crate' },
  { name: 'Body', parent: 'Crate', mesh: { size: [1, 0.8, 1], center: [0, 0.4, 0], slots: ['Wood', 'Metal'], uv: true } },
  { name: 'Lid', parent: 'Crate', position: [0, 0.85, 0], mesh: { size: [1, 0.1, 1], slots: ['Wood'], uv: true } },
];

describe('modelChanges: what Unity imports the same', () => {
  it('finds nothing in a re-export of the same model', () => {
    expect(changes({ nodes: crate }, { nodes: crate })).toEqual([]);
  });

  it('tells only the exporting app when nothing else changed', () => {
    expect(changes({ nodes: crate, exportedFrom: 'Blender 4.2.1' }, { nodes: crate, exportedFrom: 'Blender 4.2.3' })).toEqual([
      { kind: 'exporter', before: 'Blender 4.2.1', after: 'Blender 4.2.3' },
    ]);
  });

  it('tells units that changed while the size in Unity stayed, as a note', () => {
    const inCentimetres = crate.map((node) => (node.name === 'Crate' ? { ...node, scale: [100, 100, 100] as [number, number, number] } : node));
    const list = changes({ nodes: crate, unitScale: 1 }, { nodes: inCentimetres, unitScale: 0.01 });
    expect(list).toEqual([{ kind: 'unitsChanged', before: 1, after: 0.01 }]);
    expect(isRisk(list[0]!)).toBe(false);
  });
});

describe('modelChanges: the whole model', () => {
  it('tells a model 100× larger once, with its units as the cause', () => {
    const list = changes({ nodes: crate, unitScale: 0.01 }, { nodes: crate, unitScale: 1 });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'resized', units: { before: 0.01, after: 1 } });
    const resized = list[0] as Extract<ModelChange, { kind: 'resized' }>;
    expect(resized.factor).toBeCloseTo(100);
    expect(resized.heightBefore).toBeCloseTo(0.009);
    expect(resized.heightAfter).toBeCloseTo(0.9);
    expect(isRisk(resized)).toBe(true);
  });

  it('tells a model scaled on its root, without listing the root as transformed', () => {
    const scaled = crate.map((node) => (node.name === 'Crate' ? { ...node, scale: [2, 2, 2] as [number, number, number] } : node));
    const list = changes({ nodes: crate }, { nodes: scaled });
    expect(kinds(list)).toEqual(['resized']);
    expect((list[0] as Extract<ModelChange, { kind: 'resized' }>).units).toBeNull();
  });

  it('tells a scale applied to the vertices (Apply Scale) as a resize too', () => {
    const rock: TestNode[] = [{ name: 'Rock', mesh: { size: [1, 1, 1] } }];
    expect(kinds(changes({ nodes: rock }, { nodes: [{ name: 'Rock', mesh: { size: [3, 3, 3] } }] }))).toEqual(['resized']);
  });

  it('tells the Blender classic: the model turned -90° on X', () => {
    const rock: TestNode[] = [{ name: 'Rock', mesh: { size: [1, 2, 1] } }];
    const list = changes({ nodes: rock }, { nodes: [{ ...rock[0]!, rotation: [-90, 0, 0] }] });
    expect(list).toEqual([{ kind: 'turned', degrees: 90, axis: 'X' }]);
  });

  it('tells a model moved off its pivot, whether its node or its vertices moved', () => {
    const lamp = (position: [number, number, number], center: [number, number, number]): TestNode[] => [{ name: 'Lamp', position, mesh: { center } }];
    expect(changes({ nodes: lamp([0, 0, 0], [0, 0, 0]) }, { nodes: lamp([0, 0, 0], [0.3, 0, 0.4]) })).toMatchObject([{ kind: 'offPivot' }]);
    const nodeMoved = changes({ nodes: lamp([0, 0, 0], [0, 0, 0]) }, { nodes: lamp([0.3, 0, 0.4], [0, 0, 0]) });
    expect(kinds(nodeMoved)).toEqual(['offPivot']);
    expect((nodeMoved[0] as Extract<ModelChange, { kind: 'offPivot' }>).distance).toBeCloseTo(0.5);
  });

  it('tells no whole-model change when only some meshes moved', () => {
    const moved = crate.map((node) => (node.name === 'Lid' ? { ...node, position: [0, 1.2, 0] as [number, number, number] } : node));
    expect(kinds(changes({ nodes: crate }, { nodes: moved }))).toEqual(['transformed']);
  });

  it("tells a node's pivot moved when the node moved and its geometry stayed, without a shape change", () => {
    const hinged = crate.map((node) => (node.name === 'Lid' ? { ...node, position: [0, 0.85, -0.5] as [number, number, number], mesh: { ...node.mesh!, center: [0, 0, 0.5] as [number, number, number] } } : node));
    const list = changes({ nodes: crate }, { nodes: hinged });
    expect(kinds(list)).toEqual(['pivotMoved']);
    expect(list[0]).toMatchObject({ node: { name: 'Lid', path: 'Crate/Lid' } });
  });
});

describe('modelChanges: the hierarchy', () => {
  const robot: TestNode[] = [
    { name: 'Hips', kind: 'bone' },
    { name: 'Hand_L', parent: 'Hips', kind: 'bone', position: [0.5, 1, 0] },
    { name: 'Helmet', mesh: { size: [0.3, 0.3, 0.3] }, position: [0, 1.7, 0] },
    { name: 'Backpack', mesh: { size: [0.4, 0.5, 0.2] }, position: [0, 1.2, -0.2] },
  ];

  it('tells a rename, a removal and an addition in Unity terms, risks first', () => {
    const after: TestNode[] = [
      { name: 'Hips', kind: 'bone' },
      { name: 'hand.L', parent: 'Hips', kind: 'bone', position: [0.5, 1, 0] },
      { name: 'Helmet', mesh: { size: [0.3, 0.3, 0.3] }, position: [0, 1.7, 0] },
      { name: 'Antenna', kind: 'group', position: [0, 2, 0] },
    ];
    const list = changes({ nodes: robot }, { nodes: after });
    expect(list).toEqual([
      { kind: 'renamed', node: { name: 'hand.L', path: 'Hips/hand.L', kind: 'bone', before: 'Hips/Hand_L', after: 'Hips/hand.L' }, from: 'Hand_L' },
      { kind: 'removed', node: { name: 'Backpack', path: 'Backpack', kind: 'mesh', before: 'Backpack' } },
      { kind: 'added', node: { name: 'Antenna', path: 'Antenna', kind: 'group', after: 'Antenna' } },
    ]);
  });

  it('tells a node moved under another parent, with the path it had', () => {
    const after = robot.map((node) => (node.name === 'Helmet' ? { ...node, parent: 'Hips' } : node));
    expect(changes({ nodes: robot }, { nodes: after })).toMatchObject([{ kind: 'moved', node: { path: 'Hips/Helmet' }, fromPath: 'Helmet' }]);
  });

  it('tells a removed branch of the hierarchy once, at its top', () => {
    const withArm: TestNode[] = [...robot, { name: 'Arm_R', parent: 'Hips', kind: 'bone', position: [-0.3, 1.3, 0] }, { name: 'Hand_R', parent: 'Arm_R', kind: 'bone' }];
    const list = changes({ nodes: withArm }, { nodes: robot });
    expect(list).toMatchObject([{ kind: 'removed', node: { name: 'Arm_R' } }]);
  });
});

describe('modelChanges: material slots', () => {
  it('tells a slot renamed, as Unity loses the material remapped to it', () => {
    const renamed = crate.map((node) => (node.mesh ? { ...node, mesh: { ...node.mesh, slots: node.mesh.slots!.map((slot) => (slot === 'Wood' ? 'Wood_mat' : slot)) } } : node));
    expect(changes({ nodes: crate }, { nodes: renamed })).toEqual([{ kind: 'slotRenamed', from: 'Wood', to: 'Wood_mat' }]);
  });

  it('tells a slot added and one removed', () => {
    const added = crate.map((node) => (node.name === 'Lid' ? { ...node, mesh: { ...node.mesh!, slots: ['Wood', 'Label'] } } : node));
    expect(changes({ nodes: crate }, { nodes: added })).toEqual([{ kind: 'slotAdded', slot: 'Label' }]);
    const removed = crate.map((node) => (node.name === 'Body' ? { ...node, mesh: { ...node.mesh!, slots: ['Wood'] } } : node));
    expect(changes({ nodes: crate }, { nodes: removed })).toEqual([{ kind: 'slotRemoved', slot: 'Metal' }]);
  });

  it("tells a mesh that uses another of the model's slots", () => {
    const metalLid = crate.map((node) => (node.name === 'Lid' ? { ...node, mesh: { ...node.mesh!, slots: ['Metal'] } } : node));
    expect(changes({ nodes: crate }, { nodes: metalLid })).toMatchObject([{ kind: 'meshSlots', node: { name: 'Lid' }, before: ['Wood'], after: ['Metal'] }]);
  });
});

describe('modelChanges: mesh data', () => {
  const rock = (mesh: TestNode['mesh']): TestModel => ({ nodes: [{ name: 'Rock', mesh }] });

  it('tells a mesh rebuilt with another triangle count, and nothing else about it', () => {
    const before = modelSummary(testModel(rock({ uv: true })));
    const after = modelSummary(testModel(rock({ uv: true })));
    after.meshes[0]!.triangles = 240;
    after.meshes[0]!.fingerprints.uv = 'other';
    expect(modelChanges(before, after)).toMatchObject([{ kind: 'triangles', before: 12, after: 240 }]);
  });

  it('tells a shape sculpted with the same topology', () => {
    const before = modelSummary(testModel(rock({})));
    const after = modelSummary(testModel(rock({})));
    after.meshes[0]!.fingerprints.positions = 'sculpted';
    after.meshes[0]!.fingerprints.placedPositions = 'sculpted in place';
    expect(kinds(modelChanges(before, after))).toEqual(['shape']);
  });

  it('tells no shape change for vertices shifted to stay where they were, under a node moved to a new parent', () => {
    const before: TestModel = { nodes: [{ name: 'Head', position: [0, 1.7, 0] }, { name: 'Helmet', mesh: { center: [0, 1.8, 0] } }] };
    const after: TestModel = { nodes: [{ name: 'Head', position: [0, 1.7, 0] }, { name: 'Helmet', parent: 'Head', mesh: { center: [0, 0.1, 0] } }] };
    expect(kinds(changes(before, after))).toEqual(['moved']);
  });

  it('tells a sculpt that grew one side as a shape change, not a resize', () => {
    const grown = changes(rock({}), { nodes: [{ name: 'Rock', mesh: { size: [1.2, 1, 1], center: [0.1, 0, 0] } }] });
    expect(kinds(grown)).toEqual(['shape']);
  });

  it('tells normals, UVs and skinning that changed alone', () => {
    const before = modelSummary(testModel(rock({ uv: true })));
    const after = modelSummary(testModel(rock({ uv: true })));
    after.meshes[0]!.fingerprints.normals = 'smoothed';
    after.meshes[0]!.fingerprints.uv = 'repacked';
    expect(kinds(modelChanges(before, after))).toEqual(['normals', 'uvs']);
  });

  it('tells lightmap UVs lost as a risk, and gained as a note', () => {
    const lost = changes(rock({ uv1: true }), rock({}));
    expect(lost).toMatchObject([{ kind: 'lightmapUvs', now: false }]);
    expect(isRisk(lost[0]!)).toBe(true);
    expect(isRisk(changes(rock({}), rock({ uv1: true }))[0]!)).toBe(false);
  });

  it('tells vertex colors gained or lost', () => {
    expect(changes(rock({}), rock({ colors: true }))).toMatchObject([{ kind: 'vertexColors', now: true }]);
  });

  it('tells a blendshape renamed, removed or added', () => {
    const face = (blendShapes: string[]): TestModel => ({ nodes: [{ name: 'Face', mesh: { blendShapes } }] });
    expect(changes(face(['Smile', 'Blink']), face(['smile', 'Blink']))).toMatchObject([{ kind: 'blendShapeRenamed', from: 'Smile', to: 'smile' }]);
    expect(kinds(changes(face(['Smile', 'Blink']), face(['Blink', 'Frown', 'Pout'])))).toEqual(['blendShapeRemoved', 'blendShapeAdded', 'blendShapeAdded']);
  });
});

describe('modelChanges: takes and textures', () => {
  const clips = (list: { name: string; duration: number }[]): TestModel => ({ nodes: crate, clips: list });

  it('tells a take renamed when one went and one of the same length came', () => {
    expect(changes(clips([{ name: 'Run', duration: 1.2 }]), clips([{ name: 'run_fast', duration: 1.2 }]))).toEqual([{ kind: 'clipRenamed', from: 'Run', to: 'run_fast' }]);
  });

  it('tells takes removed, added and of another length', () => {
    const list = changes(clips([{ name: 'Run', duration: 1.2 }, { name: 'Idle', duration: 2 }]), clips([{ name: 'Run', duration: 0.9 }, { name: 'Jump', duration: 0.6 }, { name: 'Fall', duration: 1 }]));
    expect(list).toEqual([
      { kind: 'clipRemoved', name: 'Idle' },
      { kind: 'clipAdded', name: 'Jump' },
      { kind: 'clipAdded', name: 'Fall' },
      { kind: 'clipLength', name: 'Run', before: 1.2, after: 0.9 },
    ]);
  });

  it('tells the textures the materials name now and no longer', () => {
    expect(changes({ nodes: crate, textures: ['wood.png'] }, { nodes: crate, textures: ['wood.png', 'wood_normal.png'] })).toEqual([{ kind: 'textures', added: ['wood_normal.png'], removed: [] }]);
  });
});
