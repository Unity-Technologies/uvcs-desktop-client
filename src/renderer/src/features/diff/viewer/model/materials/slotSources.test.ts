import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_SETTINGS, readImportSettings, type ModelImportSettings } from '../modelImportSettings';
import type { FileMaterial } from '../parsedModel';
import { materialsOffered, slotSources, type ModelMaterialsInput } from './slotSources';
import { fileMaterial, named, use } from './testing/testMaterials';

const GUID = '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f';

const textured = (name: string) => fileMaterial(name, { baseMap: use(named(`${name}.png`)) });

interface VersionSpec {
  format?: ModelMaterialsInput['format'];
  /** What the file defines, by slot name; the slots are Bark and Leaves. */
  materials?: FileMaterial[];
  settings?: Partial<ModelImportSettings>;
}

function version({ format = 'fbx', materials = [textured('Bark'), fileMaterial('Leaves')], settings = {} }: VersionSpec = {}): ModelMaterialsInput {
  const byName = new Map(materials.map((material) => [material.name, material]));
  return { format, slots: ['Bark', 'Leaves'].map((name) => ({ key: name, name, material: byName.get(name) ?? null })), settings: { ...DEFAULT_IMPORT_SETTINGS, ...settings } };
}

/** Unity's `unity_builtin_extra`, where Default-Material is (fileID 10303). */
const BUILT_IN_EXTRA = '0000000000000000f000000000000000';

describe('slotSources', () => {
  it("gives a slot remapped to one of Unity's built-in materials Unity's default look, looked up nowhere", () => {
    const meta = [
      'fileFormatVersion: 2',
      'guid: 1156b86fa47a743339813f160e676ce3',
      'ModelImporter:',
      '  serializedVersion: 24300',
      '  externalObjects:',
      '  - first:',
      '      type: UnityEngine:Material',
      '      assembly: UnityEngine.CoreModule',
      '      name: Leaves',
      `    second: {fileID: 10303, guid: ${BUILT_IN_EXTRA}, type: 0}`,
    ].join('\n');
    const sources = slotSources(version({ settings: readImportSettings(meta) }));
    expect(sources.get('Leaves')).toEqual({ kind: 'default' });
  });

  it("gives each slot of an FBX the file's material, or the project's one its .meta remaps it to", () => {
    const sources = slotSources(version({ settings: { materialRemaps: [{ slot: 'Leaves', guid: GUID }] } }));
    expect(sources.get('Bark')).toEqual({ kind: 'file', material: textured('Bark') });
    expect(sources.get('Leaves')).toEqual({ kind: 'remapped', guid: GUID });
  });

  it("gives every slot Unity's default material with Material Creation Mode None, unless remaps apply then", () => {
    const none = version({ settings: { materialImport: 'none', materialRemaps: [{ slot: 'Bark', guid: GUID }] } });
    expect([...slotSources(none).values()]).toEqual([{ kind: 'default' }, { kind: 'default' }]);
    expect(slotSources({ ...none, settings: { ...none.settings, remapsWithoutMaterials: true } }).get('Bark')).toEqual({ kind: 'remapped', guid: GUID });
  });

  it("gives a slot the file defines no material for Unity's default (an OBJ without its .mtl)", () => {
    expect(slotSources(version({ format: 'obj', materials: [] })).get('Bark')).toEqual({ kind: 'default' });
  });

  it("takes a glTF's own materials, as glTFast does, whatever a .meta remaps", () => {
    const gltf = version({ format: 'glb', settings: { materialRemaps: [{ slot: 'Bark', guid: GUID }] } });
    expect(slotSources(gltf).get('Bark')).toEqual({ kind: 'file', material: textured('Bark') });
  });
});

describe('materialsOffered', () => {
  it('offers the look when a version has a texture, a color, transparency or a remap to show', () => {
    expect(materialsOffered([null, version()])).toBe(true);
    expect(materialsOffered([version({ materials: [fileMaterial('Bark', { color: [0.2, 0.4, 0.1] })] })])).toBe(true);
    expect(materialsOffered([version({ materials: [fileMaterial('Bark', { opacity: 0.5 })] })])).toBe(true);
    expect(materialsOffered([version({ materials: [], settings: { materialRemaps: [{ slot: 'Bark', guid: GUID }] } })])).toBe(true);
  });

  it("doesn't offer it when it would show the clay anyway", () => {
    expect(materialsOffered([version({ materials: [fileMaterial('Bark'), fileMaterial('Leaves')] }), null])).toBe(false);
    expect(materialsOffered([version({ settings: { materialImport: 'none' } })])).toBe(false);
    expect(materialsOffered([null, null])).toBe(false);
  });
});
