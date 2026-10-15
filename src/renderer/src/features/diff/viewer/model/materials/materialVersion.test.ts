import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_SETTINGS, type ImportSettingsSource } from '../modelImportSettings';
import { PLAIN_READ } from '../readModelFile';
import { testModel } from '../testing/testModels';
import { materialsInputOf, takesWorkspaceSettings } from './materialVersion';
import { fileMaterial } from './testing/testMaterials';

const red = fileMaterial('', { color: [1, 0, 0] });
const blue = fileMaterial('', { color: [0, 0, 1] });

describe('materialsInputOf', () => {
  it("gives each of a glTF's slots its own material, unnamed ones apart", () => {
    const model = { ...testModel({ nodes: [{ name: 'Box', mesh: { slots: ['', ''] } }] }), format: 'glb' as const, materials: [red, blue] };
    model.meshes[0]!.slotMaterials = [0, 1];
    const input = materialsInputOf({ model, bytes: { bytes: new Uint8Array(), format: 'glb' }, options: PLAIN_READ, path: 'Box.glb', point: null, sibling: () => null }, null, null);
    expect(input?.slots).toEqual([
      { key: '#0', name: '', material: red },
      { key: '#1', name: '', material: blue },
    ]);
    expect(input?.settings).toBe(DEFAULT_IMPORT_SETTINGS);
  });

  it("gives an OBJ's slots the .mtl's materials of their names, and none for a slot it doesn't define", () => {
    const model = { ...testModel({ nodes: [{ name: 'Wall', mesh: { slots: ['Brick', 'Plaster'] } }] }), format: 'obj' as const };
    const brick = fileMaterial('Brick', { color: [0.5, 0.2, 0.1] });
    const input = materialsInputOf({ model, bytes: { bytes: new Uint8Array(), format: 'obj' }, options: PLAIN_READ, path: 'Wall.obj', point: null, sibling: () => null }, [brick], null);
    expect(input?.slots).toEqual([
      { key: 'Brick', name: 'Brick', material: brick },
      { key: 'Plaster', name: 'Plaster', material: null },
    ]);
    expect(materialsInputOf(null, [brick], null)).toBeNull();
  });

  it(".meta settings: the version's own, the workspace's only when no .meta was found for the version", () => {
    const model = testModel({ nodes: [{ name: 'Ball', mesh: { slots: ['Mat1'] } }] });
    model.meshes[0]!.slotMaterials = [0];
    model.materials = [fileMaterial('Mat1', { color: [0, 0, 0] })];
    const workspace = { ...DEFAULT_IMPORT_SETTINGS, materialImport: 'none' as const };
    const version = (settingsFrom: ImportSettingsSource, settings = DEFAULT_IMPORT_SETTINGS) => ({
      model,
      bytes: { bytes: new Uint8Array(), format: 'fbx' as const },
      options: { ...PLAIN_READ, settings, settingsFrom },
      path: 'Assets/Ball.fbx',
      point: null,
      sibling: () => null,
    });
    // No .meta for the version (a last change whose .meta changed since; in History, a revision under an xlink or
    // one the model wasn't at its path in): the workspace's decides.
    expect(materialsInputOf(version('none'), null, workspace)?.settings).toBe(workspace);
    expect(materialsInputOf(version('none'), null, null)?.settings).toEqual(DEFAULT_IMPORT_SETTINGS);
    // Its own .meta, even one that reads as the defaults (no ModelImporter in it).
    expect(materialsInputOf(version('meta', { ...DEFAULT_IMPORT_SETTINGS }), null, workspace)?.settings).toEqual(DEFAULT_IMPORT_SETTINGS);
    // A read that failed shows the defaults until it is read again, never the workspace's look meanwhile.
    expect(materialsInputOf(version('failed'), null, workspace)?.settings).toEqual(DEFAULT_IMPORT_SETTINGS);
    // While the workspace's .meta is still being read, nothing is decided (nor looked up with the defaults).
    expect(materialsInputOf(version('none'), null, undefined)).toBeUndefined();
    expect(materialsInputOf(version('meta'), null, undefined)?.settings).toBe(DEFAULT_IMPORT_SETTINGS);
    expect(takesWorkspaceSettings(version('none').options)).toBe(true);
    expect(takesWorkspaceSettings(version('failed').options)).toBe(false);
  });
});
