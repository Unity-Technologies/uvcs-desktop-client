import {
  AnimationClip,
  AnimationMixer,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
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
 *  names it, its mesh under it and no blendshapes (the viewer builds none). */
function scene() {
  const model = testModel({ nodes: [{ name: 'Hips', kind: 'bone' }, { name: 'Hand L.001', kind: 'bone', parent: 'Hips' }, { name: 'Object_7', mesh: {} }] });
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
    const { clip, dropped } = playableTake(motion, scene().root);
    expect(clip).toBe(motion);
    expect(names(clip)).toEqual(['Hips.quaternion', 'Hand_L001.quaternion', 'Object_7.position']);
    expect(dropped).toEqual([]);
  });

  it("drops a mesh node's blendshape track, keeping the bones beside it", () => {
    const { clip, dropped } = playableTake(take(rotation('Hips'), blendshapes('Object_7')), scene().root);
    expect(names(clip)).toEqual(['Hips.quaternion']);
    expect(clip.name).toBe('Motion');
    expect(clip.duration).toBe(1);
    expect(dropped.map((track) => track.name)).toEqual(['Object_7.morphTargetInfluences']);
  });

  it('keeps a blendshape track on a mesh that has blendshapes: what is dropped is what the scene lacks', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
    geometry.morphAttributes.position = [new Float32BufferAttribute([0, 1, 0], 3)];
    const face = new Mesh(geometry);
    face.name = 'Face';
    const root = new Group();
    root.add(face);
    expect(names(playableTake(take(blendshapes('Face')), root).clip)).toEqual(['Face.morphTargetInfluences']);
  });

  it('drops the tracks of a node the scene has not', () => {
    const { clip, dropped } = playableTake(take(rotation('Hips'), rotation('Tail')), scene().root);
    expect(names(clip)).toEqual(['Hips.quaternion']);
    expect(dropped.map((track) => track.name)).toEqual(['Tail.quaternion']);
  });

  it("leaves a track through a sub-object (a material, a skeleton's bones) to the mixer", () => {
    const tracks = [new NumberKeyframeTrack('Object_7.material.opacity', [0, 1], [1, 0]), position('Object_7.bones[Hips]')];
    expect(playableTake(take(...tracks), scene().root).dropped).toEqual([]);
  });

  it('plays a take with blendshapes without a console error, its bones moving', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const built = scene();
    const mixer = new AnimationMixer(built.root);
    mixer.clipAction(playableTake(take(position('Hips'), blendshapes('Object_7')), built.root).clip).play();
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
