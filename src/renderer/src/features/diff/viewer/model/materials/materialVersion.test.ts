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
});
