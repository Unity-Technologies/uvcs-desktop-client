// Writes a Unity material (`.mat`) as the Editor saves one for each render pipeline's lit shader, for tests and the
// models sandbox (`scripts/sandboxes/models.sh`): the document header, the material's settings, and the saved
// properties each pipeline's shader keeps (URP's `_BaseMap`, HDRP's `_BaseColorMap`, the Built-in `_MainTex`), with only
// the values a test sets changed from the shader's defaults. Never shipped in the app.

export type RenderPipeline = 'urp' | 'hdrp' | 'builtIn';

export interface MaterialTextureSpec {
  guid: string;
  scale?: [number, number];
  offset?: [number, number];
}

export interface UnityMaterialSpec {
  name: string;
  pipeline: RenderPipeline;
  baseMap?: MaterialTextureSpec;
  normalMap?: MaterialTextureSpec;
  /** sRGB, as the Inspector shows it. */
  baseColor?: [number, number, number, number];
  alpha?: 'opaque' | 'clip' | 'blend';
  cutoff?: number;
  doubleSided?: boolean;
}

/** Each pipeline's lit shader, by the GUID of its file in the package (or 0000…f000 for a built-in one). */
const SHADERS: Record<RenderPipeline, string> = {
  urp: '{fileID: 4800000, guid: 933532a4fcc9baf4fa0491de14d08ed7, type: 3}',
  hdrp: '{fileID: 4800000, guid: 6e4ae4064600d784cac1e41a9e6f2e59, type: 3}',
  builtIn: '{fileID: 46, guid: 0000000000000000f000000000000000, type: 0}',
};

export function unityMaterialYaml(spec: UnityMaterialSpec): string {
  return [
    '%YAML 1.1',
    '%TAG !u! tag:unity3d.com,2011:',
    '--- !u!21 &2100000',
    'Material:',
    '  serializedVersion: 8',
    '  m_ObjectHideFlags: 0',
    '  m_CorrespondingSourceObject: {fileID: 0}',
    '  m_PrefabInstance: {fileID: 0}',
    '  m_PrefabAsset: {fileID: 0}',
    `  m_Name: ${spec.name}`,
    `  m_Shader: ${SHADERS[spec.pipeline]}`,
    '  m_Parent: {fileID: 0}',
    '  m_ModifiedSerializedProperties: 0',
    '  m_ValidKeywords: []',
    '  m_InvalidKeywords: []',
    '  m_LightmapFlags: 4',
    '  m_EnableInstancingVariants: 0',
    '  m_DoubleSidedGI: 0',
    '  m_CustomRenderQueue: -1',
    '  stringTagMap: {}',
    '  disabledShaderPasses: []',
    '  m_LockedProperties: ',
    '  m_SavedProperties:',
    '    serializedVersion: 3',
    '    m_TexEnvs:',
    ...textures(spec).flatMap(([name, texture]) => textureEntry(name, texture)),
    '    m_Ints: []',
    '    m_Floats:',
    ...Object.entries(floats(spec))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `    - ${name}: ${value}`),
    '    m_Colors:',
    ...colors(spec).map(([name, [r, g, b, a]]) => `    - ${name}: {r: ${r}, g: ${g}, b: ${b}, a: ${a}}`),
    '  m_BuildTextureStacks: []',
    '  m_AllowLocking: 1',
    ...(spec.pipeline === 'urp' ? urpVersion() : []),
    '',
  ].join('\n');
}

function textures({ pipeline, baseMap, normalMap }: UnityMaterialSpec): [string, MaterialTextureSpec | undefined][] {
  switch (pipeline) {
    // URP keeps `_MainTex` in step with `_BaseMap`, for scripts written for the Built-in pipeline.
    case 'urp':
      return [['_BaseMap', baseMap], ['_BumpMap', normalMap], ['_EmissionMap', undefined], ['_MainTex', baseMap], ['_OcclusionMap', undefined]];
    case 'hdrp':
      return [['_BaseColorMap', baseMap], ['_MaskMap', undefined], ['_NormalMap', normalMap]];
    case 'builtIn':
      return [['_BumpMap', normalMap], ['_DetailAlbedoMap', undefined], ['_MainTex', baseMap], ['_OcclusionMap', undefined]];
  }
}

function textureEntry(name: string, texture: MaterialTextureSpec | undefined): string[] {
  const [sx, sy] = texture?.scale ?? [1, 1];
  const [ox, oy] = texture?.offset ?? [0, 0];
  return [
    `    - ${name}:`,
    `        m_Texture: ${texture ? `{fileID: 2800000, guid: ${texture.guid}, type: 3}` : '{fileID: 0}'}`,
    `        m_Scale: {x: ${sx}, y: ${sy}}`,
    `        m_Offset: {x: ${ox}, y: ${oy}}`,
  ];
}

function floats({ pipeline, alpha = 'opaque', cutoff = 0.5, doubleSided = false }: UnityMaterialSpec): Record<string, number> {
  switch (pipeline) {
    case 'urp':
      return { _AlphaClip: alpha === 'clip' ? 1 : 0, _Blend: 0, _BumpScale: 1, _Cull: doubleSided ? 0 : 2, _Cutoff: cutoff, _Metallic: 0, _Smoothness: 0.5, _Surface: alpha === 'blend' ? 1 : 0, _WorkflowMode: 1, _ZWrite: alpha === 'blend' ? 0 : 1 };
    case 'hdrp':
      return { _AlphaCutoff: cutoff, _AlphaCutoffEnable: alpha === 'clip' ? 1 : 0, _CullMode: doubleSided ? 0 : 2, _DoubleSidedEnable: doubleSided ? 1 : 0, _Metallic: 0, _Smoothness: 0.5, _SurfaceType: alpha === 'blend' ? 1 : 0 };
    case 'builtIn':
      return { _BumpScale: 1, _Cutoff: cutoff, _Glossiness: 0.5, _Metallic: 0, _Mode: alpha === 'clip' ? 1 : alpha === 'blend' ? 3 : 0 };
  }
}

function colors({ pipeline, baseColor = [1, 1, 1, 1] }: UnityMaterialSpec): [string, [number, number, number, number]][] {
  switch (pipeline) {
    case 'urp':
      return [['_BaseColor', baseColor], ['_Color', baseColor], ['_EmissionColor', [0, 0, 0, 1]]];
    case 'hdrp':
      return [['_BaseColor', baseColor], ['_EmissiveColor', [0, 0, 0, 1]]];
    case 'builtIn':
      return [['_Color', baseColor], ['_EmissionColor', [0, 0, 0, 1]]];
  }
}

/** URP's asset version record, a second document of the file. */
function urpVersion(): string[] {
  return [
    '--- !u!114 &4513958012475930346',
    'MonoBehaviour:',
    '  m_ObjectHideFlags: 11',
    '  m_CorrespondingSourceObject: {fileID: 0}',
    '  m_PrefabInstance: {fileID: 0}',
    '  m_PrefabAsset: {fileID: 0}',
    '  m_GameObject: {fileID: 0}',
    '  m_Enabled: 1',
    '  m_EditorHideFlags: 0',
    '  m_Script: {fileID: 11500000, guid: d0353a89b1f911e48b9e16bdc9f2e058, type: 3}',
    '  m_Name: ',
    '  m_EditorClassIdentifier: ',
    '  version: 9',
  ];
}
