import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_SETTINGS, type ModelImportSettings } from '../modelImportSettings';
import { materialsOffered, slotSources, type ModelMaterialsInput } from './slotSources';
import { fileMaterial, named, use } from './testing/testMaterials';

const GUID = '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f';

const textured = (name: string) => fileMaterial(name, { baseMap: use(named(`${name}.png`)) });

function version(overrides: Partial<Omit<ModelMaterialsInput, 'settings'>> & { settings?: Partial<ModelImportSettings> } = {}): ModelMaterialsInput {
  return { format: 'fbx', slots: ['Bark', 'Leaves'], fileMaterials: [textured('Bark'), fileMaterial('Leaves')], ...overrides, settings: { ...DEFAULT_IMPORT_SETTINGS, ...overrides.settings } };
}

describe('slotSources', () => {
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
    expect(slotSources(version({ format: 'obj', fileMaterials: [] })).get('Bark')).toEqual({ kind: 'default' });
  });

  it("takes a glTF's own materials, as glTFast does, whatever a .meta remaps", () => {
    const gltf = version({ format: 'glb', settings: { materialRemaps: [{ slot: 'Bark', guid: GUID }] } });
    expect(slotSources(gltf).get('Bark')).toEqual({ kind: 'file', material: textured('Bark') });
  });
});

describe('materialsOffered', () => {
  it('offers the look when a version has a texture, a color, transparency or a remap to show', () => {
    expect(materialsOffered([null, version()])).toBe(true);
    expect(materialsOffered([version({ fileMaterials: [fileMaterial('Bark', { color: [0.2, 0.4, 0.1] })] })])).toBe(true);
    expect(materialsOffered([version({ fileMaterials: [fileMaterial('Bark', { opacity: 0.5 })] })])).toBe(true);
    expect(materialsOffered([version({ fileMaterials: [], settings: { materialRemaps: [{ slot: 'Bark', guid: GUID }] } })])).toBe(true);
  });

  it("doesn't offer it when it would show the clay anyway", () => {
    expect(materialsOffered([version({ fileMaterials: [fileMaterial('Bark'), fileMaterial('Leaves')] }), null])).toBe(false);
    expect(materialsOffered([version({ settings: { materialImport: 'none' } })])).toBe(false);
    expect(materialsOffered([null, null])).toBe(false);
  });
});
