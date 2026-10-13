import { describe, expect, it } from 'vitest';
import { BRANCH_TREE_LIFE_MS, type FoundFile, type UnityAssetsAnswer, type UnityAssetsRequest } from '@shared/domain/unityAssets';
import { findStaleTime, foundAssets, materialFiles, textureRequestOf, uniqueFiles, uniqueRequests } from './assetAnswers';
import { lookupKey } from './materialPlan';
import { named } from './testing/testMaterials';
import type { UnityMaterial } from './unityMaterial';

const MAT = '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f';
const BARK = '6d1e0c9b8a7f4e3d2c1b0a9f8e7d6c5b';
const file = (path: string): FoundFile => ({ path, size: 1, stored: 'disk', modified: 1 });
const request = (overrides: Partial<UnityAssetsRequest> = {}): UnityAssetsRequest => ({ modelPath: 'Assets/Tree.fbx', point: { kind: 'workspace' }, textures: [], guids: [], paths: [], searchTexturesGlobally: false, ...overrides });
const material: UnityMaterial = { baseMap: { guid: BARK, scale: [1, 1], offset: [0, 0] }, normalMap: null, baseColor: [1, 1, 1, 1], alpha: 'opaque', cutoff: 0.5, doubleSided: false };

describe('asset answers', () => {
  it('asks once for what both versions ask alike, and nothing for a side without a request', () => {
    const same = request({ guids: [MAT] });
    expect(uniqueRequests([same, { ...same }, null])).toEqual({ requests: [same], indices: [0, 0, -1] });
    expect(uniqueFiles([file('a.mat'), file('b.mat'), file('a.mat')], (found) => found.path).map(({ path }) => path)).toEqual(['a.mat', 'b.mat']);
  });

  it("pairs each side's remapped materials with the files found, none while unanswered", () => {
    const asked = request({ guids: [MAT, BARK] });
    expect(materialFiles([{ textures: [], guids: [file('Bark.mat'), null], paths: [], importsPsb: false, guidMisses: 'known' }, undefined], [asked, asked])).toEqual([
      [
        { guid: MAT, file: file('Bark.mat') },
        { guid: BARK, file: null },
      ],
      [
        { guid: MAT, file: null },
        { guid: BARK, file: null },
      ],
    ]);
  });

  it('asks a second round for the textures the materials use, and none when they use none', () => {
    const first = request({ guids: [MAT], textures: [{ name: 'bark.png', storedPaths: [], remapGuid: null }], paths: ['a.png'] });
    expect(textureRequestOf(first, new Map([[MAT, material]]))).toEqual({ ...first, textures: [], paths: [], guids: [BARK] });
    expect(textureRequestOf(first, new Map([[MAT, null]]))).toBeNull();
    expect(textureRequestOf(null, new Map([[MAT, material]]))).toBeNull();
  });

  it("merges both rounds' GUIDs with the textures and paths found by key", () => {
    const first = request({ guids: [MAT], textures: [{ name: 'bark.png', storedPaths: ['T\\bark.png'], remapGuid: null }], paths: ['images/a.png'] });
    const second = request({ guids: [BARK] });
    const found = foundAssets(first, { textures: [file('T/bark.png')], guids: [file('Bark.mat')], paths: [null], importsPsb: true, guidMisses: 'known' }, second, { textures: [], guids: [file('bark.psd')], paths: [], importsPsb: true, guidMisses: 'known' }, new Map([[MAT, material]]));
    expect(found.textures).toEqual(new Map([[lookupKey(named('bark.png', ['T\\bark.png'])), file('T/bark.png')]]));
    expect(found.paths).toEqual(new Map([['images/a.png', null]]));
    expect(found.guids).toEqual(new Map([[MAT, file('Bark.mat')], [BARK, file('bark.psd')]]));
    expect(found.importsPsb).toBe(true);
  });
});

describe('findStaleTime', () => {
  const answer = (guidMisses: UnityAssetsAnswer['guidMisses']): UnityAssetsAnswer => ({ textures: [], guids: [], paths: [], importsPsb: false, guidMisses });

  it("keeps a changeset's answer for good, a branch head's a while, the disk's not at all", () => {
    expect(findStaleTime({ kind: 'repository', at: 'cs:12' }, answer('known'))).toBe(Number.POSITIVE_INFINITY);
    expect(findStaleTime({ kind: 'repository', at: 'br:/main' }, answer('known'))).toBe(BRANCH_TREE_LIFE_MS);
    expect(findStaleTime({ kind: 'workspace' }, answer('known'))).toBe(0);
  });

  it("never keeps an answer that couldn't be read whole (the server down): the next look asks again", () => {
    expect(findStaleTime({ kind: 'repository', at: 'cs:12' }, answer('unread'))).toBe(0);
    expect(findStaleTime({ kind: 'repository', at: 'cs:12' }, undefined)).toBe(Number.POSITIVE_INFINITY);
  });
});
