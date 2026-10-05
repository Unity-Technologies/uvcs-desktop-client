import { AnimationClip, AnimationMixer, Bone, SkinnedMesh, VectorKeyframeTrack, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildModelScene } from './modelScene';
import { modelSummary } from './modelSummary';
import type { ParsedModel } from './parsedModel';
import { testModel } from './testing/testModels';

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
    const model = testModel({ nodes: [{ name: 'Root', kind: 'bone' }, { name: 'Body', kind: 'skinnedMesh', mesh: { bones: ['Root'] } }] });
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
