import {
  AnimationClip,
  AnimationMixer,
  NumberKeyframeTrack,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
  type KeyframeTrack,
} from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildModelScene } from './modelScene';
import { modelSummary } from './modelSummary';
import { playableTake, unplayableWords } from './playableTake';
import { testModel } from './testing/testModels';

/** The scene the viewer builds: a bone `Hips`, a bone `Hand L.001`, and a mesh node `Object_7` as a Sketchfab export
 *  names it, its mesh under it and no blendshapes. */
function scene() {
  const model = testModel({ nodes: [{ name: 'Hips', kind: 'bone' }, { name: 'Hand L.001', kind: 'bone', parent: 'Hips' }, { name: 'Object_7', mesh: {} }] });
  return buildModelScene(model, modelSummary(model));
}

/** A mesh node `Heart` with one blendshape, `Beat`, that lifts every vertex, and a bone `Hips`. */
function beatingScene() {
  const model = testModel({ nodes: [{ name: 'Hips', kind: 'bone' }, { name: 'Heart', mesh: { blendShapes: ['Beat'] } }] });
  model.meshes[0]!.blendShapes[0]!.deltas.fill(1);
  return buildModelScene(model, modelSummary(model));
}

const position = (node: string) => new VectorKeyframeTrack(`${node}.position`, [0, 1], [0, 0, 0, 0, 1, 0]);
const rotation = (node: string) => new QuaternionKeyframeTrack(`${node}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
const blendshapes = (node: string) => new NumberKeyframeTrack(`${node}.morphTargetInfluences`, [0, 1], [0, 1]);
const take = (...tracks: KeyframeTrack[]) => new AnimationClip('Motion', 1, tracks);
const names = (clip: AnimationClip) => clip.tracks.map((track) => track.name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('playableTake', () => {
  it("keeps the bones' tracks, named as the loaders name them, and every node's transform, as the very take", () => {
    const motion = take(rotation('Hips'), rotation('Hand_L001'), position('Object_7'));
    const { clip, dropped } = playableTake(motion, scene());
    expect(clip).toBe(motion);
    expect(names(clip)).toEqual(['Hips.quaternion', 'Hand_L001.quaternion', 'Object_7.position']);
    expect(dropped).toEqual([]);
  });

  it("drops the blendshape track of a mesh node without blendshapes, keeping the bones beside it", () => {
    const { clip, dropped } = playableTake(take(rotation('Hips'), blendshapes('Object_7')), scene());
    expect(names(clip)).toEqual(['Hips.quaternion']);
    expect(clip.name).toBe('Motion');
    expect(clip.duration).toBe(1);
    expect(dropped.map((track) => track.name)).toEqual(['Object_7.morphTargetInfluences']);
  });

  it("plays a glTF's blendshape track, the whole array, on the mesh of the node it names, its wireframe alike", () => {
    const built = beatingScene();
    const mixer = new AnimationMixer(built.root);
    const { clip, dropped } = playableTake(take(rotation('Hips'), blendshapes('Heart')), built);
    expect(dropped).toEqual([]);
    mixer.clipAction(clip).play();
    mixer.setTime(0.5);
    const [mesh] = built.meshes;
    expect(mesh!.solid.morphTargetInfluences).toEqual([0.5]);
    expect(mesh!.wire.morphTargetInfluences).toBe(mesh!.solid.morphTargetInfluences);
  });

  it("plays an FBX's blendshape track, one shape by its index", () => {
    const built = beatingScene();
    const mixer = new AnimationMixer(built.root);
    mixer.clipAction(playableTake(take(new NumberKeyframeTrack('Heart.morphTargetInfluences[0]', [0, 1], [0, 1])), built).clip).play();
    mixer.setTime(0.25);
    expect(built.meshes[0]!.solid.morphTargetInfluences).toEqual([0.25]);
  });

  it('puts the blendshapes back at rest with the rest pose', () => {
    const built = beatingScene();
    const mixer = new AnimationMixer(built.root);
    mixer.clipAction(playableTake(take(blendshapes('Heart')), built).clip).play();
    mixer.setTime(1);
    built.resetPose();
    expect(built.meshes[0]!.solid.morphTargetInfluences).toEqual([0]);
  });

  it('drops the tracks of a node the scene has not', () => {
    const { clip, dropped } = playableTake(take(rotation('Hips'), rotation('Tail')), scene());
    expect(names(clip)).toEqual(['Hips.quaternion']);
    expect(dropped.map((track) => track.name)).toEqual(['Tail.quaternion']);
  });

  it("leaves a track through a sub-object (a material, a skeleton's bones) to the mixer", () => {
    const tracks = [new NumberKeyframeTrack('Object_7.material.opacity', [0, 1], [1, 0]), position('Object_7.bones[Hips]')];
    expect(playableTake(take(...tracks), scene()).dropped).toEqual([]);
  });

  it('plays a take with blendshapes without a console error, its bones moving', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const built = scene();
    const mixer = new AnimationMixer(built.root);
    mixer.clipAction(playableTake(take(position('Hips'), blendshapes('Object_7')), built).clip).play();
    mixer.setTime(0.5);
    expect(error).not.toHaveBeenCalled();
    expect(built.objects.get('Hips')!.position.y).toBeCloseTo(0.5);
  });
});

describe('unplayableWords', () => {
  it('says nothing when every track plays', () => {
    expect(unplayableWords([])).toBeNull();
  });

  it('names blendshape animation when that is what is left out', () => {
    expect(unplayableWords([blendshapes('Object_7'), rotation('Tail')])).toBe("Blendshape animation isn't shown");
  });

  it('says part of the take is left out otherwise', () => {
    expect(unplayableWords([rotation('Tail')])).toBe("Part of this take isn't shown");
  });
});
