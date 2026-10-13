// A glTF material in the specular-glossiness workflow (`KHR_materials_pbrSpecularGlossiness`), which three's
// GLTFLoader no longer reads (r186 makes it a plain material, its texture lost) and glTFast still does: its diffuse
// texture is the base map and its diffuse factor the base color (RGB, linear as glTF keeps it) and opacity. Read from
// the glTF's JSON; the rest (normal map, alpha mode, sides) the loader read already.

import { gltfImagePlace, gltfTextureImage } from '../gltfJson';
import type { FileMaterial, TextureUse } from '../parsedModel';

const EXTENSION = 'KHR_materials_pbrSpecularGlossiness';

interface TextureInfo {
  index?: unknown;
  texCoord?: unknown;
  extensions?: { KHR_texture_transform?: { offset?: unknown; rotation?: unknown; scale?: unknown; texCoord?: unknown } };
}

interface SpecularGlossiness {
  diffuseFactor?: unknown;
  diffuseTexture?: TextureInfo;
}

/** The material with what its specular-glossiness extension says of its base color, or as it is without one. */
export function withSpecularGlossiness(material: FileMaterial, json: unknown, materialIndex: number): FileMaterial {
  const materials = (json as { materials?: unknown } | null)?.materials;
  const definition = Array.isArray(materials) ? (materials[materialIndex] as { extensions?: Record<string, SpecularGlossiness> } | undefined) : undefined;
  const extension = definition?.extensions?.[EXTENSION];
  if (!extension) return material;
  const factor = numbers(extension.diffuseFactor, 4) ?? [1, 1, 1, 1];
  return {
    ...material,
    color: [factor[0]!, factor[1]!, factor[2]!],
    opacity: factor[3]!,
    baseMap: material.baseMap ?? textureUse(json, extension.diffuseTexture),
  };
}

function textureUse(json: unknown, info: TextureInfo | undefined): TextureUse | null {
  if (!info || !Number.isInteger(info.index)) return null;
  const image = gltfTextureImage(json, info.index as number);
  const place = image === null ? null : gltfImagePlace(json, image);
  if (image === null || !place) return null;
  const transform = info.extensions?.KHR_texture_transform;
  const channel = [transform?.texCoord, info.texCoord].find((value): value is number => Number.isInteger(value)) ?? 0;
  return {
    texture: place.kind === 'inFile' ? { kind: 'gltfImage', image } : { kind: 'beside', path: place.path },
    repeat: (numbers(transform?.scale, 2) as [number, number] | null) ?? [1, 1],
    offset: (numbers(transform?.offset, 2) as [number, number] | null) ?? [0, 0],
    rotation: typeof transform?.rotation === 'number' ? transform.rotation : 0,
    channel,
  };
}

function numbers(value: unknown, count: number): number[] | null {
  return Array.isArray(value) && value.length === count && value.every((item) => typeof item === 'number') ? (value as number[]) : null;
}
