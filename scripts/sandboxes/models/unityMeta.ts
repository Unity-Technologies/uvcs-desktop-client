// The `.meta` files Unity 6.3 writes beside the models sandbox's models (`writeModels.ts`): ModelImporter's for FBX
// and OBJ, glTFast's ScriptedImporter for glTF and GLB (Unity has no glTF importer of its own), DefaultImporter's for
// a glTF's `.bin`. The settings are
// Unity's defaults, laid out as a Unity batch import wrote them, apart from what a step changes: the scale and the clips
// cut from the takes.

import { createHash } from 'node:crypto';

/** Unity's GUID for an asset, made from its path so every run writes the same one. */
export function guidOf(path: string): string {
  return createHash('md5').update(path).digest('hex');
}

/** A clip cut from a take, as the Animation tab of the import settings keeps it: frames at the take's frame rate. */
export interface ClipSplit {
  name: string;
  takeName: string;
  firstFrame: number;
  lastFrame: number;
  loopTime: boolean;
}

export interface ModelImporterSettings {
  /** The import settings' Scale Factor, applied over the file's own units ("Convert Units", `useFileScale`). */
  globalScale: number;
  clips?: ClipSplit[];
  /** Material slots remapped to a material of the project ("On Demand Remap" in the Materials tab), by slot name. */
  materialRemaps?: { slot: string; materialPath: string }[];
}

/** Unity's class ID for an AnimationClip, which `internalIDToNameTable` names the clips by. */
const ANIMATION_CLIP_CLASS_ID = 74;

export function modelImporterMeta(path: string, settings: ModelImporterSettings): string {
  const clips = settings.clips ?? [];
  return [
    'fileFormatVersion: 2',
    `guid: ${guidOf(path)}`,
    'ModelImporter:',
    '  serializedVersion: 24300',
    ...yamlList('  internalIDToNameTable:', clips.map((clip) => [
      '  - first:',
      `      ${ANIMATION_CLIP_CLASS_ID}: ${internalIdOf(path, clip.name)}`,
      `    second: ${clip.name}`,
    ])),
    ...externalObjects(settings.materialRemaps ?? []),
    '  materials:',
    '    materialImportMode: 2',
    '    materialName: 0',
    '    materialSearch: 1',
    '    materialLocation: 1',
    '    searchTexturesGlobally: 0',
    '  animations:',
    '    legacyGenerateAnimations: 4',
    '    bakeSimulation: 0',
    '    resampleCurves: 1',
    '    optimizeGameObjects: 0',
    '    removeConstantScaleCurves: 0',
    '    motionNodeName: ',
    '    animationImportErrors: ',
    '    animationImportWarnings: ',
    '    animationRetargetingWarnings: ',
    '    animationDoRetargetingWarnings: 0',
    '    importAnimatedCustomProperties: 0',
    '    importConstraints: 0',
    '    animationCompression: 1',
    '    animationRotationError: 0.5',
    '    animationPositionError: 0.5',
    '    animationScaleError: 0.5',
    '    animationWrapMode: 0',
    '    extraExposedTransformPaths: []',
    '    extraUserProperties: []',
    ...yamlList('    clipAnimations:', clips.map((clip) => clipAnimation(path, clip))),
    '    isReadable: 0',
    '  meshes:',
    '    lODScreenPercentages: []',
    `    globalScale: ${settings.globalScale}`,
    '    meshCompression: 0',
    '    addColliders: 0',
    '    useSRGBMaterialColor: 1',
    '    sortHierarchyByName: 1',
    '    importPhysicalCameras: 1',
    '    importVisibility: 1',
    '    importBlendShapes: 1',
    '    importCameras: 1',
    '    importLights: 1',
    '    nodeNameCollisionStrategy: 1',
    '    fileIdsGeneration: 2',
    '    swapUVChannels: 0',
    '    generateSecondaryUV: 0',
    '    useFileUnits: 1',
    '    keepQuads: 0',
    '    weldVertices: 1',
    '    bakeAxisConversion: 0',
    '    preserveHierarchy: 0',
    '    skinWeightsMode: 0',
    '    maxBonesPerVertex: 4',
    '    minBoneWeight: 0.001',
    '    optimizeBones: 1',
    '    generateMeshLods: 0',
    '    meshLodGenerationFlags: 0',
    '    maximumMeshLod: -1',
    '    meshOptimizationFlags: -1',
    '    indexFormat: 0',
    '    secondaryUVAngleDistortion: 8',
    '    secondaryUVAreaDistortion: 15.000001',
    '    secondaryUVHardAngle: 88',
    '    secondaryUVMarginMethod: 1',
    '    secondaryUVMinLightmapResolution: 40',
    '    secondaryUVMinObjectScale: 1',
    '    secondaryUVPackMargin: 4',
    '    useFileScale: 1',
    '    strictVertexDataChecks: 0',
    '  tangentSpace:',
    '    normalSmoothAngle: 60',
    '    normalImportMode: 0',
    '    tangentImportMode: 3',
    '    normalCalculationMode: 4',
    '    legacyComputeAllNormalsFromSmoothingGroupsWhenMeshHasBlendShapes: 0',
    '    blendShapeNormalImportMode: 1',
    '    normalSmoothingSource: 0',
    '  referencedClips: []',
    '  importAnimation: 1',
    '  humanDescription:',
    '    serializedVersion: 3',
    '    human: []',
    '    skeleton: []',
    '    armTwist: 0.5',
    '    foreArmTwist: 0.5',
    '    upperLegTwist: 0.5',
    '    legTwist: 0.5',
    '    armStretch: 0.05',
    '    legStretch: 0.05',
    '    feetSpacing: 0',
    '    globalScale: 1',
    '    rootMotionBoneName: ',
    '    hasTranslationDoF: 0',
    '    hasExtraRoot: 0',
    '    skeletonHasParents: 1',
    '  lastHumanDescriptionAvatarSource: {instanceID: 0}',
    '  autoGenerateAvatarMappingIfUnspecified: 1',
    '  animationType: 2',
    '  humanoidOversampling: 1',
    '  avatarSetup: 0',
    '  addHumanoidExtraRootOnlyWhenUsingAvatar: 1',
    '  importBlendShapeDeformPercent: 1',
    '  remapMaterialsIfMaterialImportModeIsNone: 0',
    '  additionalBone: 0',
    '  userData: ',
    '  assetBundleName: ',
    '  assetBundleVariant: ',
    '',
  ].join('\n');
}

function clipAnimation(path: string, clip: ClipSplit): string[] {
  return [
    '    - serializedVersion: 16',
    `      name: ${clip.name}`,
    `      takeName: ${clip.takeName}`,
    `      internalID: ${internalIdOf(path, clip.name)}`,
    `      firstFrame: ${clip.firstFrame}`,
    `      lastFrame: ${clip.lastFrame}`,
    '      wrapMode: 0',
    '      orientationOffsetY: 0',
    '      level: 0',
    '      cycleOffset: 0',
    '      loop: 0',
    '      hasAdditiveReferencePose: 0',
    `      loopTime: ${clip.loopTime ? 1 : 0}`,
    '      loopBlend: 0',
    '      loopBlendOrientation: 0',
    '      loopBlendPositionY: 0',
    '      loopBlendPositionXZ: 0',
    '      keepOriginalOrientation: 0',
    '      keepOriginalPositionY: 1',
    '      keepOriginalPositionXZ: 0',
    '      heightFromFeet: 0',
    '      mirror: 0',
    '      bodyMask: 01000000010000000100000001000000010000000100000001000000010000000100000001000000010000000100000001000000',
    '      curves: []',
    '      events: []',
    '      transformMask: []',
    '      maskType: 3',
    '      maskSource: {instanceID: 0}',
    '      additiveReferencePoseFrame: 0',
  ];
}

/** glTFast's importer (com.unity.cloud.gltfast 6.14) and its default settings; its own script's GUID. */
const GLTFAST_IMPORTER_SCRIPT_GUID = '715df9372183c47e389bb6e19fbc3b52';

export function gltfastImporterMeta(path: string): string {
  return [
    'fileFormatVersion: 2',
    `guid: ${guidOf(path)}`,
    'ScriptedImporter:',
    '  internalIDToNameTable: []',
    '  externalObjects: {}',
    '  serializedVersion: 2',
    '  userData: ',
    '  assetBundleName: ',
    '  assetBundleVariant: ',
    `  script: {fileID: 11500000, guid: ${GLTFAST_IMPORTER_SCRIPT_GUID}, type: 3}`,
    '  editorImportSettings:',
    '    generateSecondaryUVSet: 0',
    '  importSettings:',
    '    nodeNameMethod: 1',
    '    animationMethod: 2',
    '    generateMipMaps: 1',
    '    texturesReadable: 0',
    '    defaultMinFilterMode: 9729',
    '    defaultMagFilterMode: 9729',
    '    anisotropicFilterLevel: 1',
    '  instantiationSettings:',
    '    mask: -1',
    '    layer: 0',
    '    skinUpdateWhenOffscreen: 1',
    '    lightIntensityFactor: 1',
    '    sceneObjectCreation: 1',
    '  assetDependencies: []',
    '  reportItems: []',
    '',
  ].join('\n');
}

/** `externalObjects`: each remap names the slot and points at the material asset by its GUID. */
function externalObjects(remaps: { slot: string; materialPath: string }[]): string[] {
  if (remaps.length === 0) return ['  externalObjects: {}'];
  return [
    '  externalObjects:',
    ...remaps.flatMap(({ slot, materialPath }) => [
      '  - first:',
      '      type: UnityEngine:Material',
      '      assembly: UnityEngine.CoreModule',
      `      name: ${slot}`,
      `    second: {fileID: 2100000, guid: ${guidOf(materialPath)}, type: 2}`,
    ]),
  ];
}

/** A texture's `.meta`, its TextureImporter's defaults (a normal map's type 1, not sRGB), as Unity 6.3 writes the start of it. */
export function textureImporterMeta(path: string, { normalMap = false } = {}): string {
  return [
    'fileFormatVersion: 2',
    `guid: ${guidOf(path)}`,
    'TextureImporter:',
    '  internalIDToNameTable: []',
    '  externalObjects: {}',
    '  serializedVersion: 13',
    '  mipmaps:',
    '    mipMapMode: 0',
    '    enableMipMap: 1',
    `    sRGBTexture: ${normalMap ? 0 : 1}`,
    '    linearTexture: 0',
    '  isReadable: 0',
    '  streamingMipmaps: 0',
    '  textureFormat: 1',
    '  maxTextureSize: 2048',
    '  textureSettings:',
    '    serializedVersion: 2',
    '    filterMode: 1',
    '    aniso: 1',
    '    mipBias: 0',
    '    wrapU: 0',
    '    wrapV: 0',
    '    wrapW: 0',
    '  nPOTScale: 1',
    '  lightmap: 0',
    '  compressionQuality: 50',
    '  alphaUsage: 1',
    '  alphaIsTransparency: 0',
    `  textureType: ${normalMap ? 1 : 0}`,
    '  textureShape: 1',
    '  userData: ',
    '  assetBundleName: ',
    '  assetBundleVariant: ',
    '',
  ].join('\n');
}

/** A material's `.meta`: Unity keeps the material in the file itself (NativeFormatImporter). */
export function materialMeta(path: string): string {
  return ['fileFormatVersion: 2', `guid: ${guidOf(path)}`, 'NativeFormatImporter:', '  externalObjects: {}', '  mainObjectFileID: 2100000', '  userData: ', '  assetBundleName: ', '  assetBundleVariant: ', ''].join('\n');
}

/** The `.meta` of a file Unity imports as nothing in particular, like a glTF's `.bin`. */
export function defaultImporterMeta(path: string): string {
  return ['fileFormatVersion: 2', `guid: ${guidOf(path)}`, 'DefaultImporter:', '  externalObjects: {}', '  userData: ', '  assetBundleName: ', '  assetBundleVariant: ', ''].join('\n');
}

/** A YAML list under its key, or the key and `[]` when it has no items, as Unity writes them. */
function yamlList(key: string, items: string[][]): string[] {
  return items.length === 0 ? [`${key} []`] : [key, ...items.flat()];
}

/** The 64-bit ID Unity gives an object the importer makes, signed; from the asset and the object's name, so stable. */
function internalIdOf(path: string, name: string): string {
  return BigInt.asIntN(64, BigInt(`0x${createHash('md5').update(`${path}:${name}`).digest('hex').slice(0, 16)}`)).toString();
}
