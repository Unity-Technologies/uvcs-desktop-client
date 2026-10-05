// What a model's `.meta` tells Unity to do with it (its ModelImporter settings), as far as the diff reads them: the
// Scale Factor and whether the file's units count, how it is rigged (a Humanoid avatar maps Unity's human bones to
// the model's by name), the clips cut from its takes by frames, and the materials remapped onto its slots by name.
// Absent settings are Unity's defaults; a `.meta` that isn't a ModelImporter's (glTFast's, a texture's) has none.

import { isMapping, parseUnityYaml, type UnityYaml } from './unityYaml';

export interface ModelImportSettings {
  /** The Scale Factor (`meshes.globalScale`). */
  scaleFactor: number;
  /** "Convert Units" (`meshes.useFileScale`): whether the file's units count, or a file unit is a metre. */
  convertUnits: boolean;
  /** `animationType` 3: a Humanoid avatar, whose human bones map to these of the model's, by name. */
  humanoid: boolean;
  humanBones: { humanName: string; boneName: string }[];
  /** Clips cut from the takes, in the take's frames. */
  clips: { name: string; takeName: string; firstFrame: number; lastFrame: number }[];
  /** Material slots remapped to a material of the project (`externalObjects`), by slot name. */
  remappedSlots: string[];
}

export const DEFAULT_IMPORT_SETTINGS: ModelImportSettings = { scaleFactor: 1, convertUnits: true, humanoid: false, humanBones: [], clips: [], remappedSlots: [] };

const HUMANOID = '3';

/** The settings of a `.meta`'s ModelImporter; the defaults when it has none or doesn't read. */
export function readImportSettings(metaText: string): ModelImportSettings {
  const importer = parseUnityYaml(metaText).ModelImporter;
  if (!isMapping(importer)) return DEFAULT_IMPORT_SETTINGS;
  const meshes = mappingOf(importer.meshes);
  const human = mappingOf(importer.humanDescription).human;
  return {
    scaleFactor: numberOf(meshes.globalScale, 1),
    convertUnits: numberOf(meshes.useFileScale, 1) !== 0,
    humanoid: importer.animationType === HUMANOID,
    humanBones: listOf(human).flatMap((bone) => {
      const { boneName, humanName } = mappingOf(bone);
      return typeof boneName === 'string' && typeof humanName === 'string' && boneName !== '' ? [{ boneName, humanName }] : [];
    }),
    clips: listOf(mappingOf(importer.animations).clipAnimations).flatMap((clip) => {
      const { name, takeName, firstFrame, lastFrame } = mappingOf(clip);
      return typeof name === 'string' ? [{ name, takeName: typeof takeName === 'string' ? takeName : name, firstFrame: numberOf(firstFrame, 0), lastFrame: numberOf(lastFrame, 0) }] : [];
    }),
    remappedSlots: listOf(importer.externalObjects).flatMap((remap) => {
      const first = mappingOf(mappingOf(remap).first);
      return first.type === 'UnityEngine:Material' && typeof first.name === 'string' ? [first.name] : [];
    }),
  };
}

/** Metres per file unit once Unity's importer applied its settings: the file's units if they count, times the Scale Factor. */
export function importScaleOf(settings: ModelImportSettings, fileUnitScale: number): number {
  return (settings.convertUnits ? 1 : 1 / fileUnitScale) * settings.scaleFactor;
}

function mappingOf(value: UnityYaml | undefined): { [key: string]: UnityYaml } {
  return isMapping(value) ? value : {};
}

function listOf(value: UnityYaml | undefined): UnityYaml[] {
  return Array.isArray(value) ? value : [];
}

function numberOf(value: UnityYaml | undefined, fallback: number): number {
  const number = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : fallback;
}
