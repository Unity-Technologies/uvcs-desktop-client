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
  /** A material of the project by GUID; while it can't be found, the file's (or the default, without one). */
  | { kind: 'remapped'; guid: string; fallback: FileMaterial | null }
  | { kind: 'file'; material: FileMaterial };

/** What decides a version's materials. */
export interface ModelMaterialsInput {
  format: ModelFormat;
  /** Every slot its meshes use. */
  slots: string[];
  /** What the file defines: the model's own, or an OBJ's `.mtl`'s. */
  fileMaterials: FileMaterial[];
  settings: ModelImportSettings;
}

export function slotSources({ format, slots, fileMaterials, settings }: ModelMaterialsInput): Map<string, SlotSource> {
  const byName = new Map(fileMaterials.map((material) => [material.name, material]));
  const remaps = new Map(settings.materialRemaps.map(({ slot, guid }) => [slot, guid]));
  const sourceOf = (slot: string): SlotSource => {
    const material = byName.get(slot) ?? null;
    if (format === 'gltf' || format === 'glb') return material ? { kind: 'file', material } : { kind: 'default' };
    const remap = remaps.get(slot);
    if (settings.materialImport === 'none') return remap && settings.remapsWithoutMaterials ? { kind: 'remapped', guid: remap, fallback: null } : { kind: 'default' };
    if (remap) return { kind: 'remapped', guid: remap, fallback: material };
    return material ? { kind: 'file', material } : { kind: 'default' };
  };
  return new Map(slots.map((slot) => [slot, sourceOf(slot)]));
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
