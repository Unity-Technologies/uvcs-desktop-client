// Everything "What changed" tells of two versions, risks first: what changed in the file (`modelChanges`), what its
// import settings no longer fit (`importSettingsChanges`), and what changed in its materials (`materialChanges`).
// Where the materials are told, they say which textures Unity uses, so the file's own list of textures named goes.

import type { MaterialChange } from './materials/materialChanges';
import { isRisk, type ModelChange } from './modelChanges';

export interface ChangesOfVersions {
  file: ModelChange[];
  importSettings: ModelChange[];
  /** Whether both versions' import settings were read (or are absent): a failed read's defaults aren't its settings. */
  settingsRead: boolean;
  /** `materialChangesOf`: null where they can't be told, undefined while being read. */
  materials: MaterialChange[] | null | undefined;
  /** A glTF's images held in the file are named by no file: the materials compare them by place, never by content. */
  gltf: boolean;
}

export function whatChanged({ file, importSettings, settingsRead, materials, gltf }: ChangesOfVersions): ModelChange[] {
  const texturesTold = materials !== null && !gltf;
  const changes = [
    ...file.filter((change) => !texturesTold || change.kind !== 'textures'),
    ...(settingsRead ? importSettings : []),
    ...(materials ?? []).map((change): ModelChange => ({ kind: 'material', change })),
  ];
  return [...changes.filter(isRisk), ...changes.filter((change) => !isRisk(change))];
}
