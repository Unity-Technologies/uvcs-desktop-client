import { AnimationClip, Bone, BufferGeometry, Float32BufferAttribute, Group, Mesh, NumberKeyframeTrack, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import { describe, expect, it } from 'vitest';
import { playableTake, unplayableWords } from './playableTake';

/** A scene as `buildModelScene` makes it: a Group per node (the mesh under it, unnamed), a Bone per bone. */
function scene(): Group {
  const root = new Group();
  const body = new Group();
  body.name = 'Object_7';
  body.add(new Mesh(new BufferGeometry()));
  const hips = new Bone();
  hips.name = 'Hips';
  root.add(body, hips);
  return root;
}

const position = (node: string) => new VectorKeyframeTrack(`${node}.position`, [0, 1], [0, 0, 0, 0, 1, 0]);
const rotation = (node: string) => new QuaternionKeyframeTrack(`${node}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
const blendshapes = (node: string) => new NumberKeyframeTrack(`${node}.morphTargetInfluences`, [0, 1], [0, 1]);
const take = (...tracks: (VectorKeyframeTrack | QuaternionKeyframeTrack | NumberKeyframeTrack)[]) => new AnimationClip('Motion', 1, tracks);
const names = (clip: AnimationClip) => clip.tracks.map((track) => track.name);

describe('playableTake', () => {
  it("keeps the bones' tracks and every node's transform", () => {
    const { clip, dropped } = playableTake(take(rotation('Hips'), position('Hips'), position('Object_7')), scene());
    expect(names(clip)).toEqual(['Hips.quaternion', 'Hips.position', 'Object_7.position']);
    expect(clip.name).toBe('Motion');
    expect(clip.duration).toBe(1);
    expect(dropped).toEqual([]);
  });

  it('drops the blendshape tracks when the scene has no blendshapes, keeping the bones beside them', () => {
    const { clip, dropped } = playableTake(take(rotation('Hips'), blendshapes('Object_7')), scene());
    expect(names(clip)).toEqual(['Hips.quaternion']);
    expect(dropped.map((track) => track.name)).toEqual(['Object_7.morphTargetInfluences']);
  });

  it('keeps a blendshape track on a mesh that has blendshapes', () => {
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
    const { clip, dropped } = playableTake(take(rotation('Hips'), rotation('Tail')), scene());
    expect(names(clip)).toEqual(['Hips.quaternion']);
    expect(dropped.map((track) => track.name)).toEqual(['Tail.quaternion']);
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
