import { AnimationClip, AnimationMixer, Bone, SkinnedMesh, VectorKeyframeTrack, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boneLinks, buildModelScene } from './modelScene';
import { modelSummary } from './modelSummary';
import type { ParsedModel } from './parsedModel';
import { parseModel } from './parseModel';
import { placedMeshesOf } from './surfaceComparison';
import { SKINNED_TOP_CORNER, skinnedGltf } from './testing/skinnedGltf';
import { boundInFileSpace, testModel } from './testing/testModels';

function sceneOf(model: ParsedModel) {
  return buildModelScene(model, modelSummary(model));
}

describe('buildModelScene', () => {
  it("names its objects as animation tracks bind them, keeping each node's key", () => {
    const model = testModel({ nodes: [{ name: 'Hand L.001', kind: 'bone' }] });
    const scene = sceneOf(model);
    expect(scene.objects.get('Hand L.001')?.name).toBe('Hand_L001');
  });

  it("plays a take on the nodes it moves, as the file's loader bound it", () => {
    const model = testModel({ nodes: [{ name: 'Crate Lid', mesh: {} }] });
    const clip = new AnimationClip('Open', 1, [new VectorKeyframeTrack('Crate_Lid.position', [0, 1], [0, 0, 0, 0, 2, 0])]);
    model.clips = [{ name: 'Open', duration: 1, tracks: AnimationClip.toJSON(clip) }];
    const scene = sceneOf(model);
    const mixer = new AnimationMixer(scene.root);
    mixer.clipAction(AnimationClip.parse(model.clips[0]!.tracks)).play();
    mixer.setTime(0.5);
    expect(scene.objects.get('Crate Lid')!.position.y).toBeCloseTo(1);
  });

  it('builds bones as bones, and a skinned mesh bound to them, deformed where they go', () => {
    const model = testModel({
      nodes: [{ name: 'Root', kind: 'bone' }, { name: 'Body', kind: 'skinnedMesh', mesh: { bones: ['Root'] } }],
      clips: [{ name: 'Walk', duration: 1, tracks: [{ node: 'Root', property: 'position', times: [0], values: [0, 0, 0] }] }],
    });
    const inverse = new Float32Array(16);
    inverse.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    model.meshes[0]!.skin!.boneInverses = inverse;
    const scene = sceneOf(model);
    expect(scene.objects.get('Root')).toBeInstanceOf(Bone);
    const body = scene.meshes[0]!.solid;
    expect(body).toBeInstanceOf(SkinnedMesh);
    // Moving the bone carries the mesh with it: its first vertex, skinned, moves as much.
    const rest = (body as unknown as SkinnedMesh).getVertexPosition(0, new Vector3()).clone();
    scene.objects.get('Root')!.position.x += 3;
    scene.root.updateMatrixWorld(true);
    (body as unknown as SkinnedMesh).skeleton.update();
    const moved = (body as unknown as SkinnedMesh).applyBoneTransform(0, rest.clone());
    expect(moved.x - rest.x).toBeCloseTo(3);
  });
});

describe('buildModelScene, what a frame places again', () => {
  // Three composes again the matrix of every object whose `matrixAutoUpdate` is on, every frame.
  it('places again only the nodes a take moves, and each mesh with its node', () => {
    const model = testModel({
      nodes: [{ name: 'Lid', mesh: {} }, { name: 'Crate', mesh: {} }],
      clips: [{ name: 'Open', duration: 1, tracks: [{ node: 'Lid', property: 'quaternion', times: [0], values: [0, 0, 0, 1] }] }],
    });
    const scene = sceneOf(model);
    expect([scene.objects.get('Lid')!.matrixAutoUpdate, scene.objects.get('Crate')!.matrixAutoUpdate]).toEqual([true, false]);
    expect(scene.meshes.flatMap(({ solid, wire, heat, ghost }) => [solid, wire, heat, ghost]).some((object) => object.matrixAutoUpdate)).toBe(false);
  });

  it('draws a node no take moves where the file has it, and a mesh under a moved one where its node goes', () => {
    const model = testModel({
      nodes: [{ name: 'Arm', position: [1, 0, 0] }, { name: 'Hand', parent: 'Arm', position: [0, 2, 0], mesh: {} }],
      clips: [{ name: 'Wave', duration: 1, tracks: [{ node: 'Arm', property: 'position', times: [0], values: [5, 0, 0] }] }],
    });
    const scene = sceneOf(model);
    scene.root.updateMatrixWorld();
    const hand = scene.meshes[0]!.solid;
    expect(new Vector3().setFromMatrixPosition(hand.matrixWorld).toArray()).toEqual([expect.closeTo(1), expect.closeTo(2), expect.closeTo(0)]);
    scene.objects.get('Arm')!.position.x = 5;
    scene.root.updateMatrixWorld();
    expect(new Vector3().setFromMatrixPosition(hand.matrixWorld).toArray()).toEqual([expect.closeTo(5), expect.closeTo(2), expect.closeTo(0)]);
  });
});

describe('buildModelScene, a joint that is no node of the model', () => {
  // Body's vertex 0 is at (0.5, -0.5, 0.5) in its own space, its node 3 m along X.
  const drawnAndMeasured = (model: ParsedModel) => {
    // A loader's stand-in for a joint it couldn't find among the nodes.
    model.meshes[0]!.skin!.bones = [-1];
    const scene = sceneOf(model);
    scene.root.updateMatrixWorld(true);
    const body = scene.meshes[0]!.solid as unknown as SkinnedMesh;
    body.skeleton.update();
    const drawn = body.getVertexPosition(0, new Vector3()).applyMatrix4(body.matrixWorld);
    const measured = placedMeshesOf(model).meshes[0]!.positions;
    expect(drawn.toArray()).toEqual([expect.closeTo(measured[0]!), expect.closeTo(measured[1]!), expect.closeTo(measured[2]!)]);
    return measured[0];
  };
  const nodes = [{ name: 'Hips', kind: 'bone' as const, position: [0, 1, 0] as [number, number, number] }, { name: 'Body', position: [3, 0, 0] as [number, number, number], mesh: { bones: ['Hips'] } }];

  it('holds its share of the mesh where it was bound, drawn where it is measured', () => {
    // Bound as FBX binds, at Body's node.
    expect(drawnAndMeasured(testModel({ nodes }))).toBeCloseTo(3.5);
  });

  it("holds it in the file's space for a glTF, whose mesh node places nothing", () => {
    expect(drawnAndMeasured(boundInFileSpace(testModel({ nodes })))).toBeCloseTo(0.5);
  });
});

describe('buildModelScene, a skinned glTF', () => {
  // GLTFLoader reads `self.URL`, and its FileLoader reports progress with `ProgressEvent`: globals a page and a worker
  // have and Node hasn't.
  beforeEach(() => {
    vi.stubGlobal('self', globalThis);
    vi.stubGlobal('ProgressEvent', class extends Event {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("draws the mesh where its joints put it, not again under its node's units and axes", async () => {
    const read = await parseModel({ bytes: new TextEncoder().encode(skinnedGltf()), format: 'gltf' });
    if (read.kind !== 'parsed') throw new Error('Not parsed');
    const scene = sceneOf(read.model);
    // As the renderer does before each frame: an attached skin follows its mesh.
    scene.root.updateMatrixWorld(true);
    const body = scene.meshes[0]!.solid as unknown as SkinnedMesh;
    body.skeleton.update();
    // Skinned (three applies the bones), then placed by the mesh: where it is drawn.
    const top = body.getVertexPosition(SKINNED_TOP_CORNER, new Vector3()).applyMatrix4(body.matrixWorld);
    // 180 cm up the file's Z stands 1.8 m up Y, as three's own loader and Unity's glTFast draw it.
    expect(top.x).toBeCloseTo(0);
    expect(top.y).toBeCloseTo(1.8);
    expect(top.z).toBeCloseTo(0);
  });
});

describe('boneLinks', () => {
  it('links each bone to its parent bone, not to the empties above the skeleton', () => {
    const model = testModel({ nodes: [{ name: 'Armature' }, { name: 'Hips', parent: 'Armature', kind: 'bone' }, { name: 'Spine', parent: 'Hips', kind: 'bone' }, { name: 'Head', parent: 'Spine', kind: 'bone' }] });
    expect(boneLinks(model).map(([bone, parent]) => [model.nodes[bone]!.name, model.nodes[parent]!.name])).toEqual([
      ['Spine', 'Hips'],
      ['Head', 'Spine'],
    ]);
  });
});

describe('resetPose', () => {
  it('puts every node back where the file has it', () => {
    const scene = sceneOf(testModel({ nodes: [{ name: 'Lid', position: [0, 1, 0], mesh: {} }] }));
    scene.objects.get('Lid')!.position.set(5, 5, 5);
    scene.resetPose();
    expect(scene.objects.get('Lid')!.position.toArray()).toEqual([0, 1, 0]);
  });
});
