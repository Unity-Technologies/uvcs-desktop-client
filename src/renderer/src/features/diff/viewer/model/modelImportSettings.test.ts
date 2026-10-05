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
        '    second: {fileID: 2100000, guid: 0f2b, type: 2}',
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
    expect(settings.remappedSlots).toEqual(['Wood']);
  });

  it("keeps Unity's defaults for what the .meta doesn't set, or a .meta that is no ModelImporter's", () => {
    expect(readImportSettings(meta())).toEqual(DEFAULT_IMPORT_SETTINGS);
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
