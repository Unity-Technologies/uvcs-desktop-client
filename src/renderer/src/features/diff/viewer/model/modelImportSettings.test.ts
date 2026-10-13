import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_SETTINGS, importScaleOf, readImportSettings } from './modelImportSettings';

const meta = (...lines: string[]): string => ['fileFormatVersion: 2', 'guid: 1156b86fa47a743339813f160e676ce3', 'ModelImporter:', '  serializedVersion: 24300', ...lines].join('\n');

describe('readImportSettings', () => {
  it("reads the Scale Factor, not the avatar's own scale", () => {
    const settings = readImportSettings(meta('  meshes:', '    globalScale: 100', '    useFileScale: 0', '  humanDescription:', '    globalScale: 1'));
    expect(settings).toMatchObject({ scaleFactor: 100, convertUnits: false });
  });

  it('reads a Humanoid avatar and the bones it maps', () => {
    const settings = readImportSettings(
      meta('  humanDescription:', '    human:', '    - boneName: Hand_L', '      humanName: LeftHand', '    - boneName: Hips', '      humanName: Hips', '  animationType: 3'),
    );
    expect(settings).toMatchObject({ humanoid: true, humanBones: [{ boneName: 'Hand_L', humanName: 'LeftHand' }, { boneName: 'Hips', humanName: 'Hips' }] });
  });

  it('reads the clips cut from the takes, and the materials remapped onto slots', () => {
    const settings = readImportSettings(
      meta(
        '  externalObjects:',
        '  - first:',
        '      type: UnityEngine:Material',
        '      assembly: UnityEngine.CoreModule',
        '      name: Wood',
        '    second: {fileID: 2100000, guid: 0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f, type: 2}',
        '  animations:',
        '    clipAnimations:',
        '    - serializedVersion: 16',
        '      name: Wave',
        '      takeName: Wave',
        '      firstFrame: 0',
        '      lastFrame: 36',
      ),
    );
    expect(settings.clips).toEqual([{ name: 'Wave', takeName: 'Wave', firstFrame: 0, lastFrame: 36 }]);
    expect(settings.materialRemaps).toEqual([{ slot: 'Wood', guid: '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f' }]);
  });

  it('reads how materials are made: the mode, the textures remapped by name and the global texture search', () => {
    const settings = readImportSettings(
      meta(
        '  externalObjects:',
        '  - first:',
        '      type: UnityEngine:Texture2D',
        '      assembly: UnityEngine.CoreModule',
        '      name: bark_albedo',
        '    second: {fileID: 2800000, guid: 6d1e0c9b8a7f4e3d2c1b0a9f8e7d6c5b, type: 3}',
        '  - first:',
        '      type: UnityEngine:Material',
        '      assembly: UnityEngine.CoreModule',
        "      name: 'Leaves: Oak'",
        '    second: {fileID: 0}',
        '  materials:',
        '    materialImportMode: 0',
        '    materialName: 0',
        '    materialSearch: 1',
        '    materialLocation: 1',
        '    searchTexturesGlobally: 0',
        '  remapMaterialsIfMaterialImportModeIsNone: 1',
      ),
    );
    expect(settings).toMatchObject({
      materialImport: 'none',
      remapsWithoutMaterials: true,
      // A remap to nothing (`{fileID: 0}`, the asset was deleted) remaps nothing.
      materialRemaps: [],
      textureRemaps: [{ name: 'bark_albedo', guid: '6d1e0c9b8a7f4e3d2c1b0a9f8e7d6c5b' }],
      searchTexturesGlobally: false,
    });
  });

  it("reads a .meta older than Unity 2019.3's import mode, and one older than 2021.2's remaps with None, as Unity upgrades them", () => {
    const legacy = readImportSettings(meta('  materials:', '    importMaterials: 0', '    materialName: 0', '    materialSearch: 1'));
    expect(legacy).toMatchObject({ materialImport: 'none', remapsWithoutMaterials: true });
    expect(readImportSettings(meta('  materials:', '    importMaterials: 1')).materialImport).toBe('fromFile');
    expect(readImportSettings(meta('  materials:', '    materialImportMode: 0', '  remapMaterialsIfMaterialImportModeIsNone: 0')).remapsWithoutMaterials).toBe(false);
  });

  it('searches textures globally for a .meta older than the setting, and not for a model Unity has no .meta of yet', () => {
    expect(readImportSettings(meta('  materials:', '    materialImportMode: 2')).searchTexturesGlobally).toBe(true);
    expect(readImportSettings(meta('  materials:', '    materialImportMode: 1')).materialImport).toBe('fromFile');
    expect(DEFAULT_IMPORT_SETTINGS.searchTexturesGlobally).toBe(false);
  });

  it("keeps Unity's defaults for what the .meta doesn't set, or a .meta that is no ModelImporter's", () => {
    // An importer's .meta without the texture search predates it: textures were searched for everywhere then.
    expect(readImportSettings(meta())).toEqual({ ...DEFAULT_IMPORT_SETTINGS, searchTexturesGlobally: true, remapsWithoutMaterials: true });
    expect(readImportSettings('fileFormatVersion: 2\nScriptedImporter:\n  userData: \n')).toEqual(DEFAULT_IMPORT_SETTINGS);
    expect(readImportSettings('not yaml at all {')).toEqual(DEFAULT_IMPORT_SETTINGS);
  });
});

describe('importScaleOf', () => {
  it("multiplies the file's units by the Scale Factor, or takes a file unit as a metre without Convert Units", () => {
    expect(importScaleOf({ ...DEFAULT_IMPORT_SETTINGS, scaleFactor: 100 }, 0.01)).toBe(100);
    expect(importScaleOf({ ...DEFAULT_IMPORT_SETTINGS, convertUnits: false }, 0.01)).toBe(100);
  });
});
