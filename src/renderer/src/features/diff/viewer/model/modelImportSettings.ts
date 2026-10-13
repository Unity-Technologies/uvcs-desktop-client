// What a model's `.meta` tells Unity to do with it (its ModelImporter settings), as far as the diff reads them: the
// Scale Factor and whether the file's units count, how it is rigged (a Humanoid avatar maps Unity's human bones to
// the model's by name), the clips cut from its takes by frames, and how its materials are made (the Materials tab:
// the import mode, the project's materials and textures remapped onto its slots by name, the texture search).
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
  /**
   * "Material Creation Mode" (`materials.materialImportMode`): 0 none (every slot gets Unity's default material),
   * 1 the legacy Standard, 2 Import via MaterialDescription (the default). Both of the last make the file's materials.
   */
  materialImport: 'none' | 'fromFile';
  /** With no materials made, whether the remaps still apply (`remapMaterialsIfMaterialImportModeIsNone`). */
  remapsWithoutMaterials: boolean;
  /** Material slots remapped to a material of the project (`externalObjects`), by slot name: its GUID. */
  materialRemaps: { slot: string; guid: string }[];
  /** Textures the file names remapped to a texture of the project, by the name without its extension: its GUID. */
  textureRemaps: { name: string; guid: string }[];
  /**
   * Whether a texture the file names may be any file of its name in the project when the folders Unity looks in first
   * don't have it (`materials.searchTexturesGlobally`). A `.meta` older than the setting doesn't write it: true then.
   */
  searchTexturesGlobally: boolean;
}

export const DEFAULT_IMPORT_SETTINGS: ModelImportSettings = {
  scaleFactor: 1,
  convertUnits: true,
  humanoid: false,
  humanBones: [],
  clips: [],
  materialImport: 'fromFile',
  remapsWithoutMaterials: false,
  materialRemaps: [],
  textureRemaps: [],
  searchTexturesGlobally: false,
};

const HUMANOID = '3';
const NO_MATERIALS = '0';

/** The settings of a `.meta`'s ModelImporter; the defaults when it has none or doesn't read. */
export function readImportSettings(metaText: string): ModelImportSettings {
  const importer = parseUnityYaml(metaText).ModelImporter;
  if (!isMapping(importer)) return DEFAULT_IMPORT_SETTINGS;
  const meshes = mappingOf(importer.meshes);
  const human = mappingOf(importer.humanDescription).human;
  const materials = mappingOf(importer.materials);
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
    materialImport: materials.materialImportMode === NO_MATERIALS ? 'none' : 'fromFile',
    remapsWithoutMaterials: importer.remapMaterialsIfMaterialImportModeIsNone === '1',
    materialRemaps: remapsOf(importer.externalObjects, 'UnityEngine:Material').map(({ name, guid }) => ({ slot: name, guid })),
    textureRemaps: remapsOf(importer.externalObjects, 'UnityEngine:Texture2D'),
    searchTexturesGlobally: materials.searchTexturesGlobally === undefined || numberOf(materials.searchTexturesGlobally, 1) !== 0,
  };
}

/** The `externalObjects` of a type: `{first: {type, name}, second: {fileID, guid, type}}`, a remap to the asset of that GUID. */
function remapsOf(externalObjects: UnityYaml | undefined, type: string): { name: string; guid: string }[] {
  return listOf(externalObjects).flatMap((remap) => {
    const first = mappingOf(mappingOf(remap).first);
    const { guid } = mappingOf(mappingOf(remap).second);
    return first.type === type && typeof first.name === 'string' && typeof guid === 'string' && isGuid(guid) ? [{ name: first.name, guid }] : [];
  });
}

/** A Unity GUID: 32 hex digits. */
export function isGuid(value: string): boolean {
  return /^[0-9a-f]{32}$/i.test(value);
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
