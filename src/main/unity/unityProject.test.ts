import { describe, expect, it } from 'vitest';
import { unityProjectFound, unityProjectOf } from './unityProject';

describe('unityProjectOf', () => {
  it("takes an outer folder for the project only when it is named exactly Assets, as Unity's is", () => {
    // A folder of source art named `assets` above a project is no project's.
    expect(unityProjectOf('art/assets/Game/Assets/Tree.fbx')).toEqual({ root: 'art/assets/Game', assets: 'art/assets/Game/Assets' });
    // With none named exactly, the outermost of any case: a project copied between machines.
    expect(unityProjectOf('art/assets/Tree.fbx')).toEqual({ root: 'art', assets: 'art/assets' });
  });
});

describe('unityProjectFound', () => {
  it('is the nearest folder whose Assets has a ProjectSettings folder beside it', async () => {
    const holding = (roots: string[]) => async (root: string) => roots.includes(root);
    // A project kept inside another project's Assets.
    expect(await unityProjectFound('Hub/Assets/Game/Assets/Tree.fbx', holding(['Hub', 'Hub/Assets/Game']))).toEqual({ root: 'Hub/Assets/Game', assets: 'Hub/Assets/Game/Assets' });
    // A vendor's package with an Assets folder of its own inside the project's.
    expect(await unityProjectFound('Game/Assets/Vendor/Assets/Tree.fbx', holding(['Game']))).toEqual({ root: 'Game', assets: 'Game/Assets' });
    // Without ProjectSettings anywhere (a project checked in without it), by name.
    expect(await unityProjectFound('art/assets/Game/Assets/Tree.fbx', holding([]))).toEqual({ root: 'art/assets/Game', assets: 'art/assets/Game/Assets' });
    expect(await unityProjectFound('SourceArt/Tree.fbx', holding(['']))).toBeNull();
  });
});
