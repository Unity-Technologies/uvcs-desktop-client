import { describe, expect, it } from 'vitest';
import type { MaterialChange } from './materials/materialChanges';
import type { ModelChange, NodeRef } from './modelChanges';
import { whatChanged, type ChangesOfVersions } from './whatChanged';

const TEXTURES: ModelChange = { kind: 'textures', added: ['rock.png'], removed: ['planks.png'], nodes: [] };
const EXPORTER: ModelChange = { kind: 'exporter', before: 'Blender 4.2.1', after: 'Blender 4.2.3' };
const SCALE: ModelChange = { kind: 'scaleFactor', before: { scaleFactor: 1, convertUnits: true }, after: { scaleFactor: 100, convertUnits: true } };
const MISSING: MaterialChange = { kind: 'source', slot: 'Glass', before: { kind: 'default' }, after: { kind: 'missing' } };
const REPAINTED: MaterialChange = { kind: 'baseColor', slot: 'Main', before: '#CA9337', after: '#3881E1' };

const kinds = (changes: ModelChange[]): string[] => changes.map((change) => (change.kind === 'material' ? `material:${change.change.kind}` : change.kind));

function of(overrides: Partial<ChangesOfVersions> = {}): ChangesOfVersions {
  return { file: [EXPORTER, TEXTURES], importSettings: [SCALE], settingsRead: true, materials: [], materialsNotCompared: null, fileMaterials: [], gltf: false, slotNodes: () => [], ...overrides };
}

describe('whatChanged', () => {
  it("tells the file's, the import settings' and the materials' changes, risks first", () => {
    expect(kinds(whatChanged(of({ materials: [MISSING] })))).toEqual(['material:source', 'exporter', 'scaleFactor']);
  });

  it("drops the file's textures where the materials say which ones Unity uses, or are being read to", () => {
    expect(kinds(whatChanged(of({ materials: [] })))).toEqual(['exporter', 'scaleFactor']);
    expect(kinds(whatChanged(of({ materials: undefined })))).toEqual(['exporter', 'scaleFactor']);
  });

  it("keeps them where the materials can't be told, and for a glTF, whose images in the file the materials know by place only", () => {
    expect(kinds(whatChanged(of({ materials: null })))).toEqual(['exporter', 'textures', 'scaleFactor']);
    expect(kinds(whatChanged(of({ gltf: true })))).toEqual(['exporter', 'textures', 'scaleFactor']);
  });

  it("tells, as a note, materials that may have changed but couldn't be compared: never that nothing changed", () => {
    expect(whatChanged(of({ file: [], importSettings: [], materials: null, materialsNotCompared: 'noLibrary' }))).toEqual([{ kind: 'materialsNotCompared', reason: 'noLibrary' }]);
    expect(kinds(whatChanged(of({ materials: null, materialsNotCompared: 'unread' })))).toEqual(['exporter', 'textures', 'scaleFactor', 'materialsNotCompared']);
  });

  it("tells what changed in the file's own materials where Unity's can't be resolved at all: without a point, or outside a Unity project", () => {
    expect(kinds(whatChanged(of({ materials: null, fileMaterials: [REPAINTED] })))).toEqual(['exporter', 'textures', 'scaleFactor', 'material:baseColor']);
    // Outside a Unity project the file's materials are all there is: told, they need no note that they weren't compared.
    expect(whatChanged(of({ file: [], importSettings: [], materials: null, materialsNotCompared: 'noProject', fileMaterials: [REPAINTED] }))).toEqual([{ kind: 'material', change: REPAINTED, nodes: [] }]);
    expect(kinds(whatChanged(of({ file: [], importSettings: [], materials: null, materialsNotCompared: 'noProject' })))).toEqual(['materialsNotCompared']);
  });

  it("leaves the file's own materials alone where Unity's are told, or where the project may remap them otherwise", () => {
    expect(kinds(whatChanged(of({ materials: [], fileMaterials: [REPAINTED] })))).toEqual(['exporter', 'scaleFactor']);
    expect(kinds(whatChanged(of({ file: [], importSettings: [], materials: null, materialsNotCompared: 'noLibrary', fileMaterials: [REPAINTED] })))).toEqual(['materialsNotCompared']);
  });

  it('gives each material change the meshes that use its slot, to frame them', () => {
    const body: NodeRef = { name: 'Body', path: 'Body', kind: 'mesh', before: 'Body', after: 'Body' };
    const changes = whatChanged(of({ file: [], importSettings: [], materials: [REPAINTED], slotNodes: (slot) => (slot === 'Main' ? [body] : []) }));
    expect(changes).toEqual([{ kind: 'material', change: REPAINTED, nodes: [body] }]);
  });

  it("a .meta whose read failed tells nothing of its settings: Unity's defaults stand in for it", () => {
    expect(kinds(whatChanged(of({ settingsRead: false })))).toEqual(['exporter']);
  });
});
