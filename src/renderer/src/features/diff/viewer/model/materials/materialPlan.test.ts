import { describe, expect, it } from 'vitest';
import type { FoundFile } from '@shared/domain/unityAssets';
import { DEFAULT_IMPORT_SETTINGS, type ModelImportSettings } from '../modelImportSettings';
import type { FileMaterial } from '../parsedModel';
import { assetsRequest, budgeted, lookupKey, materialTextureGuids, planVersion, slotLooks, texturesReport, type FoundAssets, type NeedState, type VersionPlan } from './materialPlan';
import { slotSources, type ModelMaterialsInput } from './slotSources';
import { fileMaterial, named, use } from './testing/testMaterials';
import type { UnityMaterial } from './unityMaterial';

const MODEL = 'Assets/Tree/Tree.fbx';
const BARK_MAT = '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f';
const BARK_PSD = '6d1e0c9b8a7f4e3d2c1b0a9f8e7d6c5b';
const BARK_NORMAL = '1a2b3c4d5e6f708192a3b4c5d6e7f809';

const file = (path: string): FoundFile => ({ path, size: 10, modified: 1 });
const bitmap = {} as ImageBitmap;

function version(fileMaterials: FileMaterial[], settings: Partial<ModelImportSettings> = {}, format: ModelMaterialsInput['format'] = 'fbx'): ModelMaterialsInput {
  return { format, slots: fileMaterials.map((material) => material.name), fileMaterials, settings: { ...DEFAULT_IMPORT_SETTINGS, ...settings } };
}

function found(overrides: Partial<FoundAssets> = {}): FoundAssets {
  return { textures: new Map(), paths: new Map(), guids: new Map(), materials: new Map(), ...overrides };
}

function plan(input: ModelMaterialsInput, assets: FoundAssets, side = 'after'): VersionPlan {
  return planVersion(input, slotSources(input), assets, MODEL, side);
}

const URP_BARK: UnityMaterial = {
  baseMap: { guid: BARK_PSD, scale: [2, 2], offset: [0.5, 0] },
  normalMap: { guid: BARK_NORMAL, scale: [1, 1], offset: [0, 0] },
  baseColor: [1, 1, 1, 1],
  alpha: 'opaque',
  cutoff: 0.5,
  doubleSided: false,
};

describe('assetsRequest', () => {
  it('asks for the remapped materials by GUID, the textures by name with a remapped one first, and a glTF image beside it by path', () => {
    const bark = fileMaterial('Bark', { baseMap: use(named('bark_albedo.png', ['..\\Textures\\bark_albedo.png'])) });
    const leaves = fileMaterial('Leaves', { baseMap: use(named('leaves.tga')) });
    const fbx = version([bark, leaves], { materialRemaps: [{ slot: 'Leaves', guid: BARK_MAT }], textureRemaps: [{ name: 'bark_albedo', guid: BARK_PSD }], searchTexturesGlobally: true });
    expect(assetsRequest(fbx, slotSources(fbx), MODEL)).toEqual({
      modelPath: MODEL,
      // A remapped slot's own textures still count: its material may not be found.
      textures: [
        { name: 'bark_albedo.png', storedPaths: ['..\\Textures\\bark_albedo.png'], remapGuid: BARK_PSD },
        { name: 'leaves.tga', storedPaths: [], remapGuid: null },
      ],
      guids: [BARK_MAT],
      paths: [],
      searchTexturesGlobally: true,
    });
    const gltf = version([fileMaterial('Leaf', { baseMap: use({ kind: 'beside', path: 'textures/leaf.png' }), normalMap: use({ kind: 'beside', path: '../escape.png' }) })], {}, 'gltf');
    expect(assetsRequest(gltf, slotSources(gltf), 'Models/Leaf.gltf').paths).toEqual(['Models/textures/leaf.png']);
  });

  it("asks a .mat's textures by their GUIDs", () => {
    expect(materialTextureGuids([URP_BARK, null, { ...URP_BARK, normalMap: null }])).toEqual([BARK_PSD, BARK_NORMAL]);
  });
});

describe('planVersion and slotLooks', () => {
  it("shows a file's textured material untinted once its texture decodes, in its color meanwhile", () => {
    const bark = fileMaterial('Bark', { color: [0.5, 0.2, 0.1], baseMap: use(named('bark.png')) });
    const planned = plan(version([bark]), found({ textures: new Map([[lookupKey(named('bark.png')), file('Assets/Tree/bark.png')]]) }));
    expect(planned.needs).toEqual([{ id: 'up:Assets/Tree/bark.png', name: 'bark.png', where: { kind: 'file', file: file('Assets/Tree/bark.png') }, flipY: true }]);
    expect(slotLooks(planned, new Map()).get('Bark')).toMatchObject({ color: [0.5, 0.2, 0.1], baseMap: null });
    const ready = new Map<string, NeedState>([['up:Assets/Tree/bark.png', { kind: 'ready', key: 'k', bitmap }]]);
    expect(slotLooks(planned, ready).get('Bark')).toMatchObject({ color: [1, 1, 1], baseMap: { key: 'k', repeat: [1, 1] } });
  });

  it('keeps the base color under a glTF base map, as glTFast multiplies them', () => {
    const leaf = fileMaterial('Leaf', { color: [0.5, 1, 1], baseMap: use({ kind: 'gltfImage', image: 0 }) });
    const planned = plan(version([leaf], {}, 'glb'), found(), 'before');
    expect(planned.needs).toEqual([{ id: 'before:image:0', name: 'image 1', where: { kind: 'gltfImage', image: 0 }, flipY: false }]);
    expect(slotLooks(planned, new Map([['before:image:0', { kind: 'ready', key: 'k', bitmap }]])).get('Leaf')?.color).toEqual([0.5, 1, 1]);
  });

  it(".mat: its maps by GUID with their tiling, its color, and the file's material while the .mat isn't found", () => {
    const input = version([fileMaterial('Bark', { color: [0.3, 0.3, 0.3] })], { materialRemaps: [{ slot: 'Bark', guid: BARK_MAT }] });
    const assets = found({ guids: new Map([[BARK_PSD, file('Assets/Art/bark.psd')], [BARK_NORMAL, file('Assets/Art/bark_n.png')]]), materials: new Map([[BARK_MAT, URP_BARK]]) });
    const planned = plan(input, assets);
    expect(planned.slots.get('Bark')).toMatchObject({ baseMap: { need: 'up:Assets/Art/bark.psd', repeat: [2, 2], offset: [0.5, 0] }, normalMap: { need: 'up:Assets/Art/bark_n.png' }, color: [1, 1, 1] });
    expect(plan(input, found()).slots.get('Bark')).toMatchObject({ color: [0.3, 0.3, 0.3], baseMap: null });
  });

  it("reads a .mat's alpha clip, transparency and sides, its color from sRGB", () => {
    const input = version([fileMaterial('Leaf')], { materialRemaps: [{ slot: 'Leaf', guid: BARK_MAT }] });
    const leaf: UnityMaterial = { ...URP_BARK, baseMap: null, normalMap: null, baseColor: [0.5, 0.5, 0.5, 0.4], alpha: 'clip', cutoff: 0.3, doubleSided: true };
    const slot = plan(input, found({ materials: new Map([[BARK_MAT, leaf]]) })).slots.get('Leaf');
    expect(slot).toMatchObject({ alpha: 'clip', cutoff: 0.3, doubleSided: true, opacity: 1 });
    expect(slot!.color.map((value) => Number(value.toFixed(3)))).toEqual([0.214, 0.214, 0.214]);
    expect(plan(input, found({ materials: new Map([[BARK_MAT, { ...leaf, alpha: 'blend' }]]) })).slots.get('Leaf')?.opacity).toBe(0.4);
  });

  it("draws Unity's default material as clay, and says which textures aren't there or aren't shown", () => {
    const input = version([fileMaterial('Bark', { baseMap: use(named('bark.png')), normalMap: use(named('bark_n.dds')) })], {});
    const planned = plan(input, found({ textures: new Map([[lookupKey(named('bark_n.dds')), file('Assets/Tree/bark_n.dds')]]) }));
    expect(planned.issues).toEqual([
      { name: 'bark.png', problem: 'missing' },
      { name: 'bark_n.dds', problem: 'unsupportedFormat' },
    ]);
    expect(plan(version([fileMaterial('Bark', { color: [1, 0, 0] })], { materialImport: 'none' }), found()).slots.get('Bark')).toBeNull();
  });
});

describe('budgeted', () => {
  const needs = (side: string, count: number) => ({
    slots: new Map(),
    issues: [],
    needs: Array.from({ length: count }, (_, i) => ({ id: `up:Assets/t${side === 'shared' ? 0 : i}-${i}.png`, name: `t${i}.png`, where: { kind: 'file' as const, file: file(`t${i}.png`) }, flipY: true })),
  });

  it('decodes a file both versions use once, at 2048 px', () => {
    const shared = needs('a', 3);
    expect(budgeted([shared, shared])).toMatchObject({ longest: 2048, over: [] });
    expect(budgeted([shared, shared]).needs).toHaveLength(3);
  });

  it('decodes the first 64 at 1024 px past 24, and says the rest are past the budget', () => {
    const many = budgeted([needs('a', 70)]);
    expect(many.needs).toHaveLength(64);
    expect(many.over).toHaveLength(6);
    expect(many.longest).toBe(1024);
    const report = texturesReport([needs('a', 70)], new Map(), many.over);
    expect(report.issues.filter(({ problem }) => problem === 'overBudget')).toHaveLength(6);
    expect(report).toMatchObject({ total: 70, shown: 0, loading: 64 });
  });
});

describe('texturesReport', () => {
  it('counts each texture once across both versions: shown, loading, and those that failed or are missing', () => {
    const input = version([fileMaterial('Bark', { baseMap: use(named('bark.png')), normalMap: use(named('moss.psd')) }), fileMaterial('Leaves', { baseMap: use(named('gone.png')) })]);
    const assets = found({
      textures: new Map([
        [lookupKey(named('bark.png')), file('Assets/Tree/bark.png')],
        [lookupKey(named('moss.psd')), file('Assets/Tree/moss.psd')],
      ]),
    });
    const before = plan(input, assets, 'before');
    const after = plan(input, assets, 'after');
    const states = new Map<string, NeedState>([
      ['up:Assets/Tree/bark.png', { kind: 'ready', key: 'k', bitmap }],
      ['up:Assets/Tree/moss.psd', { kind: 'failed', problem: 'psdWithoutComposite' }],
    ]);
    expect(texturesReport([before, after], states, [])).toEqual({
      total: 3,
      shown: 1,
      loading: 0,
      issues: [
        { name: 'gone.png', problem: 'missing' },
        { name: 'moss.psd', problem: 'psdWithoutComposite' },
      ],
    });
  });
});
