import { AnimationClip, NumberKeyframeTrack, QuaternionKeyframeTrack, VectorKeyframeTrack, type KeyframeTrack } from 'three';
import { describe, expect, it } from 'vitest';
import { nodesTakesMove } from './nodesTakesMove';

const take = (...tracks: KeyframeTrack[]) => ({ tracks: AnimationClip.toJSON(new AnimationClip('Take', 1, tracks)) });

describe('nodesTakesMove', () => {
  it('moves the nodes whose position, rotation or scale a take keys', () => {
    const moves = nodesTakesMove([take(new VectorKeyframeTrack('Hand_L.position', [0], [0, 0, 0])), take(new QuaternionKeyframeTrack('Hips.quaternion', [0], [0, 0, 0, 1]), new VectorKeyframeTrack('Lid.scale', [0], [1, 1, 1]))]);
    expect(['Hand_L', 'Hips', 'Lid', 'Spine'].map(moves)).toEqual([true, true, true, false]);
  });

  it('moves nothing for a blendshape track: weights change a shape, not where its node is', () => {
    const moves = nodesTakesMove([take(new NumberKeyframeTrack('Face.morphTargetInfluences[0]', [0], [1]))]);
    expect(moves('Face')).toBe(false);
  });

  it('moves nothing without takes', () => {
    expect(nodesTakesMove([])('Root')).toBe(false);
  });

  it('moves every node when a track reaches its node through another', () => {
    const moves = nodesTakesMove([take(new VectorKeyframeTrack('Armature.bones[Hip].position', [0], [0, 0, 0]))]);
    expect(['Armature', 'Hip', 'Anything'].map(moves)).toEqual([true, true, true]);
  });
});
