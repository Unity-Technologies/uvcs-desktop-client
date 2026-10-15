import { describe, expect, it } from 'vitest';
import { isRisk, modelChanges, type ModelChange } from './modelChanges';
import { modelSummary } from './modelSummary';
import type { FileImage, ParsedModel } from './parsedModel';
import { fileMaterial, use } from './materials/testing/testMaterials';
import { boundAtOrigin, boundInFileSpace, testModel, type TestModel, type TestNode } from './testing/testModels';

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
    expect(list[0]).toMatchObject({ kind: 'resized', cause: { kind: 'units', before: 0.01, after: 1 } });
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
    expect((list[0] as Extract<ModelChange, { kind: 'resized' }>).cause).toBeNull();
  });

  it("tells a model resized by its import settings' Scale Factor, its file as it was", () => {
    const list = changes({ nodes: crate, importScale: 1 }, { nodes: crate, importScale: 100 });
    expect(list).toMatchObject([{ kind: 'resized', cause: { kind: 'importSettings', before: 1, after: 100 } }]);
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

describe('modelChanges: a skinned model', () => {
  const character = (hips: [number, number, number], body: TestNode = { name: 'Body', parent: 'Armature', mesh: { size: [0.5, 1.6, 0.3], bones: ['Hips'] } }): TestNode[] => [
    { name: 'Armature' },
    { name: 'Hips', parent: 'Armature', kind: 'bone', position: hips },
    body,
  ];
  const summaryOf = (nodes: TestNode[], bind: (model: ReturnType<typeof testModel>) => ReturnType<typeof testModel>) => modelSummary(bind(testModel({ nodes })));

  it("tells no change for a skinned mesh's node turned alone, which places nothing", () => {
    // glTF ignores a skinned mesh's node: its joints alone place it, and they didn't move.
    const turned = character([0, 1, 0], { name: 'Body', parent: 'Armature', rotation: [0, 90, 0], mesh: { size: [0.5, 1.6, 0.3], bones: ['Hips'] } });
    expect(modelChanges(summaryOf(character([0, 1, 0]), boundInFileSpace), summaryOf(turned, boundInFileSpace))).toEqual([]);
  });

  it("tells a bone's rest pose moved as the bone, not as the model moved off its pivot", () => {
    // Both bound with the bones at the origin: the Hips standing 5 cm higher carries the mesh up with it.
    const list = modelChanges(summaryOf(character([0, 1, 0]), boundAtOrigin), summaryOf(character([0, 1.05, 0]), boundAtOrigin));
    expect(list).toEqual([{ kind: 'transformed', nodes: [expect.objectContaining({ name: 'Hips' })] }]);
  });

  const withHat = (hat: TestNode['mesh'], body: TestNode['mesh'] = { size: [0.5, 1.6, 0.3], bones: ['Hips'] }): TestNode[] => [
    ...character([0, 1, 0], { name: 'Body', parent: 'Armature', mesh: body }),
    { name: 'Hat', parent: 'Armature', position: [0, 1.9, 0], mesh: hat },
  ];
  const wholeModel = (list: ModelChange[]) => kinds(list).filter((kind) => kind === 'resized' || kind === 'turned' || kind === 'offPivot');

  it("tells no whole-model change when only a rigid part's vertices changed beside a skinned body", () => {
    const hat = { size: [0.3, 0.2, 0.3] as [number, number, number] };
    const scaled = modelChanges(summaryOf(withHat(hat), boundAtOrigin), summaryOf(withHat({ size: [0.6, 0.4, 0.6] }), boundAtOrigin));
    const moved = modelChanges(summaryOf(withHat(hat), boundAtOrigin), summaryOf(withHat({ ...hat, center: [0, 0.1, 0] }), boundAtOrigin));
    expect(wholeModel(scaled)).toEqual([]);
    expect(wholeModel(moved)).toEqual([]);
  });

  it('tells a model moved off its pivot when its skinned body moved with its rigid parts', () => {
    const before = withHat({ size: [0.3, 0.2, 0.3] });
    const after = withHat({ size: [0.3, 0.2, 0.3], center: [0, 0.1, 0] }, { size: [0.5, 1.6, 0.3], center: [0, 0.1, 0], bones: ['Hips'] });
    expect(wholeModel(modelChanges(summaryOf(before, boundAtOrigin), summaryOf(after, boundAtOrigin)))).toEqual(['offPivot']);
  });

  /** The version after, bound as the version before was: the same bind, its bones carried by what changed above them. */
  const reboundAs = (after: ParsedModel, before: ParsedModel): ParsedModel => ({ ...after, meshes: after.meshes.map((mesh, i) => ({ ...mesh, skin: before.meshes[i]!.skin })) });
  const glTF = (nodes: TestNode[]) => boundInFileSpace(testModel({ nodes }));

  it('tells a skinned glTF turned as a whole, its joints carrying the mesh round, with or without rigid parts', () => {
    const sword: TestNode = { name: 'Sword', parent: 'Armature', position: [0.4, 1, 0], mesh: { size: [0.05, 1, 0.05] } };
    for (const parts of [[], [sword]]) {
      const before = glTF([...character([0, 1, 0]), ...parts]);
      const turned = glTF([{ name: 'Armature', rotation: [0, 90, 0] }, ...character([0, 1, 0]).slice(1), ...parts]);
      const list = modelChanges(modelSummary(before), modelSummary(reboundAs(turned, before)));
      expect(list.filter((change) => change.kind === 'turned')).toEqual([{ kind: 'turned', degrees: 90, axis: 'Y' }]);
    }
  });

  it('tells a skinned glTF scaled on its root as resized', () => {
    const before = glTF(character([0, 1, 0]));
    const scaled = glTF([{ name: 'Armature', scale: [2, 2, 2] }, ...character([0, 1, 0]).slice(1)]);
    const list = modelChanges(modelSummary(before), modelSummary(reboundAs(scaled, before)));
    expect(list).toEqual([expect.objectContaining({ kind: 'resized', factor: expect.closeTo(2) })]);
  });

  it('still tells a skinned model 100× larger, with its units as the cause', () => {
    const list = modelChanges(modelSummary(testModel({ nodes: character([0, 1, 0]), unitScale: 0.01 })), modelSummary(testModel({ nodes: character([0, 1, 0]), unitScale: 1 })));
    expect(list).toEqual([expect.objectContaining({ kind: 'resized', cause: { kind: 'units', before: 0.01, after: 1 } })]);
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

  describe('its triangles', () => {
    /** The rock with an index: its 12 triangles as `triangles` lists them, each three of its 36 vertices. */
    const indexed = (triangles: number[][]): ParsedModel => {
      const model = testModel(rock({}));
      model.meshes[0]!.index = Uint32Array.from(triangles.flat());
      return model;
    };
    const asStored = Array.from({ length: 12 }, (_, t) => [3 * t, 3 * t + 1, 3 * t + 2]);

    it('tells nothing when only their order changed, as a re-export writes them and Unity reorders them anyway', () => {
      // Every triangle another place in the list, and its corners started from another one, keeping its winding.
      const reordered = [...asStored].reverse().map(([a, b, c]) => [b!, c!, a!]);
      expect(modelChanges(modelSummary(indexed(asStored)), modelSummary(indexed(reordered)))).toEqual([]);
    });

    it('tells triangles whose winding turned, over the same vertices, as faces flipped', () => {
      const flipped = asStored.map(([a, b, c], t) => (t < 2 ? [a!, c!, b!] : [a!, b!, c!]));
      expect(modelChanges(modelSummary(indexed(asStored)), modelSummary(indexed(flipped)))).toMatchObject([{ kind: 'facesFlipped', node: { name: 'Rock' } }]);
    });

    it('tells a face triangulated another way, over the same vertices, as that and not as a shape change', () => {
      // The first face's quad (corners 0, 1, 2, 3 at vertices 0, 1, 2 and 5) split along its other diagonal.
      const otherDiagonal = [[0, 1, 5], [1, 2, 5], ...asStored.slice(2)];
      expect(modelChanges(modelSummary(indexed(asStored)), modelSummary(indexed(otherDiagonal)))).toMatchObject([{ kind: 'triangulation', node: { name: 'Rock' } }]);
    });
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

  describe('keys changed in a take of the same name and length', () => {
    const rig: TestNode[] = [
      { name: 'Hips', kind: 'bone' },
      { name: 'Leg L', parent: 'Hips', kind: 'bone' },
      { name: 'Tail', parent: 'Hips', kind: 'bone' },
      { name: 'Body', mesh: { bones: ['Hips', 'Leg L', 'Tail'] } },
    ];
    const run = (legSwing: number, tailSway: number, hipsBounce = 0.1): TestModel => ({
      nodes: rig,
      clips: [
        {
          name: 'Run',
          duration: 1,
          tracks: [
            { node: 'Hips', property: 'position', times: [0, 0.5, 1], values: [0, 1, 0, 0, 1 + hipsBounce, 0, 0, 1, 0] },
            { node: 'Leg L', property: 'quaternion', times: [0, 1], values: [0, 0, 0, 1, legSwing, 0, 0, Math.sqrt(1 - legSwing ** 2)] },
            { node: 'Tail', property: 'quaternion', times: [0, 1], values: [0, 0, 0, 1, 0, tailSway, 0, Math.sqrt(1 - tailSway ** 2)] },
          ],
        },
        { name: 'Idle', duration: 2, tracks: [{ node: 'Hips', property: 'position', times: [0, 2], values: [0, 1, 0, 0, 1, 0] }] },
      ],
    });

    it('tells the take, and the nodes whose keys changed, by their names in the file, parents first', () => {
      expect(changes(run(0.3, 0.1), run(0.5, 0.2, 0.2))).toMatchObject([
        { kind: 'clipKeys', name: 'Run', nodes: [{ name: 'Hips', kind: 'bone' }, { name: 'Leg L' }, { name: 'Tail' }] },
      ]);
      expect(changes(run(0.3, 0.1), run(0.3, 0.25))).toMatchObject([{ kind: 'clipKeys', name: 'Run', nodes: [{ name: 'Tail', before: 'Hips/Tail', after: 'Hips/Tail' }] }]);
    });

    it("tells nothing of keys a re-export rounded differently, or of a take that didn't change", () => {
      expect(changes(run(0.3, 0.1), run(0.3 + 1e-7, 0.1))).toEqual([]);
    });

    it('tells a node the take no longer moves, or moves now', () => {
      const withoutTail = run(0.3, 0.1);
      withoutTail.clips![0]!.tracks!.pop();
      expect(changes(run(0.3, 0.1), withoutTail)).toMatchObject([{ kind: 'clipKeys', name: 'Run', nodes: [{ name: 'Tail' }] }]);
    });

    it("tells nothing of a blendshape added beside a take's blendshape keys, which keeps its weight at 0", () => {
      const face = (shapes: string[], weights: number[][]): TestModel => ({
        nodes: [{ name: 'Face', mesh: { blendShapes: shapes } }],
        clips: [{ name: 'Talk', duration: 1, tracks: [{ node: 'Face', property: 'morphTargetInfluences', times: [0, 1], values: weights.flat() }] }],
      });
      const talking = face(['Open'], [[0], [1]]);
      expect(changes(talking, face(['Open', 'Excited'], [[0, 0], [1, 0]]))).toMatchObject([{ kind: 'blendShapeAdded', name: 'Excited' }]);
      expect(changes(talking, face(['Open'], [[0], [0.6]]))).toMatchObject([{ kind: 'clipKeys', name: 'Talk', nodes: [{ name: 'Face' }] }]);
    });

    it('leaves a take of another length to its length, which already says it changed', () => {
      const longer = run(0.5, 0.1);
      longer.clips![0]!.duration = 1.5;
      expect(kinds(changes(run(0.3, 0.1), longer))).toEqual(['clipLength']);
    });
  });

  it('tells the textures the materials name now and no longer', () => {
    expect(changes({ nodes: crate, textures: ['wood.png'] }, { nodes: crate, textures: ['wood.png', 'wood_normal.png'] })).toEqual([{ kind: 'textures', added: ['wood_normal.png'], removed: [], nodes: [] }]);
  });

  describe('textures a glTF holds', () => {
    // A tree whose leaves' material maps the file's first image, and whose trunk's maps none.
    const tree = (images: FileImage[]): TestModel => ({
      nodes: [
        { name: 'Trunk', mesh: { slots: ['Bark'], materials: [0] } },
        { name: 'Leaves', mesh: { slots: ['Leaves'], materials: [1] } },
      ],
      materials: [fileMaterial('Bark'), fileMaterial('Leaves', { baseMap: use({ kind: 'gltfImage', image: 0 }) })],
      images,
    });

    it('tells them by their names, with the meshes that show them, as the file names no texture file', () => {
      expect(changes(tree([{ name: 'Leaves_Summer', bytes: 'summer' }]), tree([{ name: 'Leaves_Autumn', bytes: 'autumn' }]))).toMatchObject([
        { kind: 'textures', added: ['Leaves_Autumn'], removed: ['Leaves_Summer'], nodes: [{ name: 'Leaves', before: 'Leaves', after: 'Leaves' }] },
      ]);
    });

    it('tells one repainted under its name, with the meshes that show it', () => {
      expect(changes(tree([{ name: 'Leaves', bytes: 'green' }]), tree([{ name: 'Leaves', bytes: 'red' }]))).toMatchObject([
        { kind: 'embeddedTextures', names: ['Leaves'], nodes: [{ name: 'Leaves' }] },
      ]);
      expect(changes(tree([{ name: 'Leaves', bytes: 'green' }]), tree([{ name: 'Leaves', bytes: 'green' }]))).toEqual([]);
    });

    it("leaves an image in a file of its own to that file's diff: the model holds only its name", () => {
      expect(changes(tree([{ name: 'leaves.png', bytes: null }]), tree([{ name: 'leaves.png', bytes: null }]))).toEqual([]);
    });
  });
});
