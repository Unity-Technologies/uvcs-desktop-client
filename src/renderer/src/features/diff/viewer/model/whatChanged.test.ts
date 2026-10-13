import { describe, expect, it } from 'vitest';
import type { MaterialChange } from './materials/materialChanges';
import type { ModelChange } from './modelChanges';
import { whatChanged, type ChangesOfVersions } from './whatChanged';

const TEXTURES: ModelChange = { kind: 'textures', added: ['rock.png'], removed: ['planks.png'] };
const EXPORTER: ModelChange = { kind: 'exporter', before: 'Blender 4.2.1', after: 'Blender 4.2.3' };
const SCALE: ModelChange = { kind: 'scaleFactor', before: { scaleFactor: 1, convertUnits: true }, after: { scaleFactor: 100, convertUnits: true } };
const MISSING: MaterialChange = { kind: 'source', slot: 'Glass', before: { kind: 'default' }, after: { kind: 'missing' } };

const kinds = (changes: ModelChange[]): string[] => changes.map((change) => (change.kind === 'material' ? `material:${change.change.kind}` : change.kind));

function of(overrides: Partial<ChangesOfVersions> = {}): ChangesOfVersions {
  return { file: [EXPORTER, TEXTURES], importSettings: [SCALE], settingsRead: true, materials: [], gltf: false, ...overrides };
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

  it("A .meta whose read failed tells nothing of its settings: Unity's defaults stand in for it", () => {
    expect(kinds(whatChanged(of({ settingsRead: false })))).toEqual(['exporter']);
  });
});
