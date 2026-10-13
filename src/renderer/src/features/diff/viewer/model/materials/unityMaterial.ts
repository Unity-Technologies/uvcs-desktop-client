// A Unity material (`.mat`) as the Materials look draws it, whatever its shader: its base map and normal map with
// their tiling and offset, its base color, and how it treats alpha and back faces. The shader itself isn't known (it is
// a GUID of a package's file), and doesn't need to be: URP, HDRP and the Built-in pipeline each name these properties
// their own way, and a material keeps the values of the ones its shader has, so the first one present is taken.

import { isGuid } from '../modelImportSettings';
import { isMapping, parseUnityYaml, type UnityYaml } from '../unityYaml';

/** A texture a material uses: the asset's GUID, and the tiling and offset applied to the UVs (`uv * scale + offset`). */
export interface MaterialTexture {
  guid: string;
  scale: [number, number];
  offset: [number, number];
}

export type AlphaMode = 'opaque' | 'clip' | 'blend';

export interface UnityMaterial {
  baseMap: MaterialTexture | null;
  normalMap: MaterialTexture | null;
  /** RGBA as the material keeps it: in sRGB, as the Inspector shows it. */
  baseColor: [number, number, number, number];
  alpha: AlphaMode;
  /** The alpha below which a clipped material draws nothing. */
  cutoff: number;
  doubleSided: boolean;
}

/** URP's, then HDRP's, then the Built-in pipeline's. */
const BASE_MAPS = ['_BaseMap', '_BaseColorMap', '_MainTex'];
const NORMAL_MAPS = ['_BumpMap', '_NormalMap'];
const BASE_COLORS = ['_BaseColor', '_Color'];
const CUTOFFS = ['_Cutoff', '_AlphaCutoff'];
const DEFAULT_CUTOFF = 0.5;

/** The Built-in Standard shader's Rendering Mode (`_Mode`). */
const BUILT_IN_CUTOUT = 1;
const BUILT_IN_FADE = 2;
const BUILT_IN_TRANSPARENT = 3;

/** The material in a `.mat`'s text; null when it holds none (not a material, or not the YAML Unity writes). */
export function readUnityMaterial(text: string): UnityMaterial | null {
  const material = parseUnityYaml(text).Material;
  if (!isMapping(material)) return null;
  const saved = isMapping(material.m_SavedProperties) ? material.m_SavedProperties : {};
  const textures = namedEntries(saved.m_TexEnvs);
  const floats = namedEntries(saved.m_Floats);
  const colors = namedEntries(saved.m_Colors);
  const float = (name: string): number | undefined => numberOf(floats.get(name));
  const builtInMode = float('_Mode');
  const clipped = float('_AlphaClip') === 1 || float('_AlphaCutoffEnable') === 1 || builtInMode === BUILT_IN_CUTOUT;
  const blended = float('_Surface') === 1 || float('_SurfaceType') === 1 || builtInMode === BUILT_IN_FADE || builtInMode === BUILT_IN_TRANSPARENT;
  return {
    baseMap: firstTexture(textures, BASE_MAPS),
    normalMap: firstTexture(textures, NORMAL_MAPS),
    baseColor: firstColor(colors, BASE_COLORS) ?? [1, 1, 1, 1],
    alpha: blended ? 'blend' : clipped ? 'clip' : 'opaque',
    cutoff: CUTOFFS.map(float).find((value) => value !== undefined) ?? DEFAULT_CUTOFF,
    doubleSided: float('_Cull') === 0 || float('_CullMode') === 0 || float('_DoubleSidedEnable') === 1,
  };
}

/** Unity writes a material's properties as a list of one-key mappings: `- _BaseMap: {…}`. */
function namedEntries(list: UnityYaml | undefined): Map<string, UnityYaml> {
  const entries = new Map<string, UnityYaml>();
  for (const item of Array.isArray(list) ? list : []) {
    if (!isMapping(item)) continue;
    for (const [name, value] of Object.entries(item)) if (!entries.has(name)) entries.set(name, value);
  }
  return entries;
}

/** The first of these textures the material sets: a null reference (`{fileID: 0}`) sets none. */
function firstTexture(textures: Map<string, UnityYaml>, names: string[]): MaterialTexture | null {
  for (const name of names) {
    const entry = textures.get(name);
    if (!isMapping(entry) || !isMapping(entry.m_Texture)) continue;
    const { guid } = entry.m_Texture;
    if (typeof guid !== 'string' || !isGuid(guid)) continue;
    return { guid: guid.toLowerCase(), scale: pairOf(entry.m_Scale, 1), offset: pairOf(entry.m_Offset, 0) };
  }
  return null;
}

function firstColor(colors: Map<string, UnityYaml>, names: string[]): [number, number, number, number] | null {
  for (const name of names) {
    const color = colors.get(name);
    if (!isMapping(color)) continue;
    const [r, g, b, a] = ['r', 'g', 'b', 'a'].map((channel) => numberOf(color[channel]) ?? 1) as [number, number, number, number];
    return [r, g, b, a];
  }
  return null;
}

function pairOf(value: UnityYaml | undefined, fallback: number): [number, number] {
  const pair = isMapping(value) ? value : {};
  return [numberOf(pair.x) ?? fallback, numberOf(pair.y) ?? fallback];
}

function numberOf(value: UnityYaml | undefined): number | undefined {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}
