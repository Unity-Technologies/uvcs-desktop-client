// Where each material slot's material comes from, as Unity decides it (docs/features/model-diff.md, "Materials").
// FBX and OBJ go through Unity's ModelImporter, whose settings the model's `.meta` holds: with "Material Creation Mode"
// None every slot gets Unity's default material; otherwise a slot the `.meta` remaps to a project material takes it,
// and any other the material the file defines (an OBJ's in its `.mtl`). A legacy "Use External Materials" location,
// obsolete since Unity 2019.3, counts as the file's own. glTF goes through glTFast, which takes the file's materials.

import type { ModelFormat } from '@shared/domain/content';
import type { ModelImportSettings } from '../modelImportSettings';
import type { FileMaterial } from '../parsedModel';

export type SlotSource =
  /** Unity's default material: the clay. */
  | { kind: 'default' }
  /**
   * A material of the project by GUID. One the project hasn't (deleted, never checked in) is clay: Unity assigns the
   * missing asset, its "missing material", never the file's own.
   */
  | { kind: 'remapped'; guid: string }
  | { kind: 'file'; material: FileMaterial };

/** A slot of the model's meshes, once per `slotKeysOf` key: its name, and the material the file defines for it. */
export interface MaterialSlot {
  key: string;
  name: string;
  /** The model's own, or an OBJ's `.mtl`'s; null where the file defines none. */
  material: FileMaterial | null;
}

/** What decides a version's materials. */
export interface ModelMaterialsInput {
  format: ModelFormat;
  slots: MaterialSlot[];
  settings: ModelImportSettings;
}

/** Each slot's source, by its key. */
export function slotSources({ format, slots, settings }: ModelMaterialsInput): Map<string, SlotSource> {
  const remaps = new Map(settings.materialRemaps.map(({ slot, guid }) => [slot, guid]));
  const sourceOf = ({ name, material }: MaterialSlot): SlotSource => {
    if (format === 'gltf' || format === 'glb') return material ? { kind: 'file', material } : { kind: 'default' };
    const remap = remaps.get(name);
    if (settings.materialImport === 'none') return remap && settings.remapsWithoutMaterials ? { kind: 'remapped', guid: remap } : { kind: 'default' };
    if (remap) return { kind: 'remapped', guid: remap };
    return material ? { kind: 'file', material } : { kind: 'default' };
  };
  return new Map(slots.map((slot) => [slot.key, sourceOf(slot)]));
}

/**
 * Whether the Materials look shows anything the clay doesn't for these versions: a slot remapped to a project's
 * material, or a material of the file with a texture or a color of its own. Never a button that does nothing.
 */
export function materialsOffered(versions: readonly (ModelMaterialsInput | null)[]): boolean {
  return versions.some((version) => version !== null && [...slotSources(version).values()].some(showsSomething));
}

function showsSomething(source: SlotSource): boolean {
  if (source.kind === 'remapped') return true;
  if (source.kind === 'default') return false;
  const { material } = source;
  return material.baseMap !== null || material.normalMap !== null || material.color.some((channel) => Math.abs(channel - 1) > 0.01) || material.opacity < 1;
}
