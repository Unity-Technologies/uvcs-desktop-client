import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_SETTINGS } from '../modelImportSettings';
import { PLAIN_READ } from '../readModelFile';
import { testModel } from '../testing/testModels';
import { materialsInputOf } from './materialVersion';
import { fileMaterial } from './testing/testMaterials';

const red = fileMaterial('', { color: [1, 0, 0] });
const blue = fileMaterial('', { color: [0, 0, 1] });

describe('materialsInputOf', () => {
  it("gives each of a glTF's slots its own material, unnamed ones apart", () => {
    const model = { ...testModel({ nodes: [{ name: 'Box', mesh: { slots: ['', ''] } }] }), format: 'glb' as const, materials: [red, blue] };
    model.meshes[0]!.slotMaterials = [0, 1];
    const input = materialsInputOf({ model, bytes: { bytes: new Uint8Array(), format: 'glb' }, options: PLAIN_READ, path: 'Box.glb' }, null);
    expect(input?.slots).toEqual([
      { key: '#0', name: '', material: red },
      { key: '#1', name: '', material: blue },
    ]);
    expect(input?.settings).toBe(DEFAULT_IMPORT_SETTINGS);
  });

  it("gives an OBJ's slots the .mtl's materials of their names, and none for a slot it doesn't define", () => {
    const model = { ...testModel({ nodes: [{ name: 'Wall', mesh: { slots: ['Brick', 'Plaster'] } }] }), format: 'obj' as const };
    const brick = fileMaterial('Brick', { color: [0.5, 0.2, 0.1] });
    const input = materialsInputOf({ model, bytes: { bytes: new Uint8Array(), format: 'obj' }, options: PLAIN_READ, path: 'Wall.obj' }, [brick]);
    expect(input?.slots).toEqual([
      { key: 'Brick', name: 'Brick', material: brick },
      { key: 'Plaster', name: 'Plaster', material: null },
    ]);
    expect(materialsInputOf(null, [brick])).toBeNull();
  });

  it(".meta settings: the version's when its .meta was read, the workspace's when none was found for it", () => {
    const model = testModel({ nodes: [{ name: 'Ball', mesh: { slots: ['Mat1'] } }] });
    model.meshes[0]!.slotMaterials = [0];
    model.materials = [fileMaterial('Mat1', { color: [0, 0, 0] })];
    const none = { ...DEFAULT_IMPORT_SETTINGS, materialImport: 'none' as const };
    const version = (settings = DEFAULT_IMPORT_SETTINGS) => ({ model, bytes: { bytes: new Uint8Array(), format: 'fbx' as const }, options: { ...PLAIN_READ, settings }, path: 'Assets/Ball.fbx' });
    // The last change in Files reads no .meta for a version whose .meta changed since: the workspace's decides.
    expect(materialsInputOf(version(), null, none)?.settings).toBe(none);
    const remapped = { ...DEFAULT_IMPORT_SETTINGS, materialRemaps: [{ slot: 'Mat1', guid: '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f' }] };
    expect(materialsInputOf(version(remapped), null, none)?.settings).toBe(remapped);
    expect(materialsInputOf(version(), null, null)?.settings).toBe(DEFAULT_IMPORT_SETTINGS);
  });
});
