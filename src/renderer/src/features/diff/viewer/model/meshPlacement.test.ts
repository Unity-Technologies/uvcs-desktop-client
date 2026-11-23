import { describe, expect, it } from 'vitest';
import { leansPastSkeleton } from './meshPlacement';
import { testModel } from './testing/testModels';

/** A body skinned wholly to its one joint, `Root`. */
const body = () => testModel({ nodes: [{ name: 'Root', kind: 'bone' }, { name: 'Body', kind: 'skinnedMesh', mesh: { bones: ['Root'] } }] }).meshes[0]!;

describe('leansPastSkeleton', () => {
  it('is false for a skin whose every vertex leans on its own joints, and for a rigid mesh', () => {
    expect(leansPastSkeleton(body())).toBe(false);
    expect(leansPastSkeleton(testModel({ nodes: [{ name: 'Crate', mesh: {} }] }).meshes[0]!)).toBe(false);
  });

  it('is true when a vertex leans, with a weight, on a joint past the skin', () => {
    const mesh = body();
    mesh.attributes.skinIndex![4] = 1;
    expect(leansPastSkeleton(mesh)).toBe(true);
  });

  it('is false when a joint past the skin is named with no weight: nothing reads it', () => {
    const mesh = body();
    mesh.attributes.skinIndex![5] = 7;
    expect(leansPastSkeleton(mesh)).toBe(false);
  });
});
