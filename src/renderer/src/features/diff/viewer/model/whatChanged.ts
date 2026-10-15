// Everything "What changed" tells of two versions, risks first: what changed in the file (`modelChanges`), what its
// import settings no longer fit (`importSettingsChanges`), and what changed in its materials (`materialChanges`).
// Where the materials are told, they say which textures Unity uses, so the file's own list of textures named goes.
// Where they can't be resolved at all (no point to look them up at, or no Unity project) and both `.meta` files were
// read (a remap they hold would hide the file's material), the file's own materials stand in (`fileMaterialChanges`):
// a color repainted is still told.

import type { MaterialChange } from './materials/materialChanges';
import type { NotKnownReason } from './materials/materialComparison';
import { isRisk, type ModelChange, type NodeRef } from './modelChanges';

export interface ChangesOfVersions {
  file: ModelChange[];
  importSettings: ModelChange[];
  /** Whether both versions' import settings were read (or are absent): a failed read's defaults aren't its settings. */
  settingsRead: boolean;
  /** `materialChangesOf`: null where they can't be told, undefined while being read. */
  materials: MaterialChange[] | null | undefined;
  /** `materialsNotComparedOf`: why materials that may have changed couldn't be compared. */
  materialsNotCompared: NotKnownReason | null;
  /** `fileMaterialChanges`: what changed in the materials the file defines, told where Unity's can't be resolved. */
  fileMaterials: MaterialChange[];
  /** The meshes that use a slot (`meshesUsingSlot`): what a material's row frames. */
  slotNodes: (slot: string) => NodeRef[];
  /** A glTF's images held in the file are named by no file: the materials compare them by place, never by content. */
  gltf: boolean;
}

export function whatChanged({ file, importSettings, settingsRead, materials, materialsNotCompared, fileMaterials, gltf, slotNodes }: ChangesOfVersions): ModelChange[] {
  const texturesTold = materials !== null && !gltf;
  // The project's lookups (a remap, a texture search) can't resolve where there's no point or no project: the file's
  // materials are what there is, unless a `.meta` that couldn't be read remaps them. Elsewhere (no Library, a read that
  // failed) a slot may be remapped, and the note says so.
  const fileMaterialsStandIn = materials === null && settingsRead && (materialsNotCompared === null || materialsNotCompared === 'noProject');
  const told = materials ?? (fileMaterialsStandIn ? fileMaterials : []);
  // Never "Nothing Unity imports changed" when the materials may have and couldn't be compared, unless the file's told.
  const notCompared = materialsNotCompared && !(fileMaterialsStandIn && told.length > 0) ? [{ kind: 'materialsNotCompared' as const, reason: materialsNotCompared }] : [];
  const changes = [
    ...file.filter((change) => !texturesTold || change.kind !== 'textures'),
    ...(settingsRead ? importSettings : []),
    ...told.map((change): ModelChange => ({ kind: 'material', change, nodes: slotNodes(change.slot) })),
    ...notCompared,
  ];
  return [...changes.filter(isRisk), ...changes.filter((change) => !isRisk(change))];
}
