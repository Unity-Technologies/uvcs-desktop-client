import type { ContentSource, ModelBytes } from '@shared/domain/content';
import type { AssetsPoint } from '@shared/domain/unityAssets';
import type { ModelImportSettings } from '../modelImportSettings';
import type { FileMaterial, ParsedModel } from '../parsedModel';
import type { ModelReadOptions } from '../readModelFile';
import { slotKeysOf } from './slotKeys';
import type { MaterialSlot, ModelMaterialsInput } from './slotSources';

/** A version of the model as read, where it is in the workspace (null when it names no path there), and at what point. */
export interface MaterialVersion {
  model: ParsedModel;
  bytes: ModelBytes;
  options: ModelReadOptions;
  path: string | null;
  /** Where its materials and textures are looked up (`AssetsPoint`); null where none is known: only the file's own show. */
  point: AssetsPoint | null;
  /** A file beside it, as the version of it that goes with this one (`SiblingFinder`): an OBJ's `.mtl`. */
  sibling: (fileName: string) => ContentSource | null;
}

/**
 * What decides a version's materials: each slot once by its key (`slotKeysOf`), with the material the file defines for
 * it: the model's own, or for an OBJ the `.mtl`'s of the slot's name (`mtl`, read beside it); and the import settings
 * of the version's `.meta`, or, when none was found for the version (`takesWorkspaceSettings`), of the workspace's
 * (`workspaceSettings`: null where the workspace has none), as Unity imports the model now. Undefined while that
 * one is still being read: nothing is looked up with settings about to change.
 */
export function materialsInputOf(version: MaterialVersion | null, mtl: FileMaterial[] | null, workspaceSettings: ModelImportSettings | null | undefined): ModelMaterialsInput | null | undefined {
  if (!version) return null;
  const fromWorkspace = takesWorkspaceSettings(version.options);
  if (fromWorkspace && workspaceSettings === undefined) return undefined;
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
  return { format: model.format, slots: [...slots.values()], settings: (fromWorkspace && workspaceSettings) || version.options.settings };
}

/**
 * Whether a version's materials take the workspace's `.meta` settings: only when no `.meta` was found for it (a last
 * change whose `.meta` changed since, a revision in History, a merge's source); never for one whose read failed,
 * which shows the defaults until read again, rather than the workspace's look and then its own.
 */
export function takesWorkspaceSettings(options: ModelReadOptions): boolean {
  return options.settingsFrom === 'none';
}
