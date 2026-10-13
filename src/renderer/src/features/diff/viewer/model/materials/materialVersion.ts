import type { ModelBytes } from '@shared/domain/content';
import type { ModelImportSettings } from '../modelImportSettings';
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
 * it: the model's own, or for an OBJ the `.mtl`'s of the slot's name (`mtl`, read beside it); and the import settings
 * of the version's `.meta`, or, when none was found for the version (`takesWorkspaceSettings`), of the workspace's
 * (`workspaceSettings`), as Unity imports the model now.
 */
export function materialsInputOf(version: MaterialVersion | null, mtl: FileMaterial[] | null, workspaceSettings: ModelImportSettings | null = null): ModelMaterialsInput | null {
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
  const { settings } = version.options;
  return { format: model.format, slots: [...slots.values()], settings: takesWorkspaceSettings(version.options) && workspaceSettings ? workspaceSettings : settings };
}

/**
 * Whether a version's materials take the workspace's `.meta` settings: only when no `.meta` was found for it (a last
 * change whose `.meta` changed since, a revision in History, a merge's source); never for one whose read failed,
 * which shows the defaults until read again, rather than the workspace's look and then its own.
 */
export function takesWorkspaceSettings(options: ModelReadOptions): boolean {
  return options.settingsFrom === 'none';
}
