import type { ModelBytes } from '@shared/domain/content';
import type { FileMaterial, ParsedModel } from '../parsedModel';
import type { ModelReadOptions } from '../readModelFile';
import { slotKeysOf } from './slotKeys';
import type { MaterialSlot, ModelMaterialsInput } from './slotSources';

/** A version of the model as read, and where it is in the workspace (null when it names no path there). */
export interface MaterialVersion {
  model: ParsedModel;
  bytes: ModelBytes;
  options: ModelReadOptions;
  path: string | null;
}

/**
 * What decides a version's materials: each slot once by its key (`slotKeysOf`), with the material the file defines for
 * it: the model's own, or for an OBJ the `.mtl`'s of the slot's name (`mtl`, read beside it).
 */
export function materialsInputOf(version: MaterialVersion | null, mtl: FileMaterial[] | null): ModelMaterialsInput | null {
  if (!version) return null;
  const { model } = version;
  const mtlByName = new Map((mtl ?? []).map((material) => [material.name, material]));
  const slots = new Map<string, MaterialSlot>();
  for (const mesh of model.meshes) {
    slotKeysOf(model.format, mesh).forEach((key, i) => {
      if (slots.has(key)) return;
      const name = mesh.slots[i]!;
      const material = model.format === 'obj' ? (mtlByName.get(name) ?? null) : (model.materials[mesh.slotMaterials[i] ?? -1] ?? null);
      slots.set(key, { key, name, material });
    });
  }
  return { format: model.format, slots: [...slots.values()], settings: version.options.settings };
}
