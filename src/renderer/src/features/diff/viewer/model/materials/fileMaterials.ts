// The materials a model file defines, read from the three.js materials its loader made: each slot's color, opacity,
// base and normal maps (which texture, and how its UVs are transformed), how it treats alpha and back faces. Which
// texture a map is depends on the loader (`TextureSource`): an FBX's by its texture's id, a glTF's by its image.

import { DoubleSide, type Material, type Mesh, type Object3D, type Texture } from 'three';
import type { AlphaMode, FileMaterial, FileTexture, TextureUse } from '../parsedModel';

/** What a loader's texture stands for, or null when nothing can be told of it. */
export type TextureSource = (texture: Texture) => FileTexture | null;

/** What the three.js materials the loaders make (Phong, Lambert, Standard) have in common, as far as this reads. */
interface LoadedMaterial {
  name: string;
  color?: { r: number; g: number; b: number };
  opacity: number;
  transparent: boolean;
  alphaTest: number;
  side: number;
  map?: Texture | null;
  normalMap?: Texture | null;
  alphaMap?: Texture | null;
}

/** glTF's default alpha cutoff, which a material in MASK mode without one has. */
const DEFAULT_CUTOFF = 0.5;

/** Each slot's material, once per name, in the order the meshes use them. */
export function fileMaterialsOf(root: Object3D, sourceOf: TextureSource): FileMaterial[] {
  const byName = new Map<string, FileMaterial>();
  root.traverse((object) => {
    if (!(object as Mesh).isMesh) return;
    const { material } = object as Mesh;
    for (const each of Array.isArray(material) ? material : [material]) {
      if (!byName.has(each.name)) byName.set(each.name, fileMaterialOf(each, sourceOf));
    }
  });
  return [...byName.values()];
}

function fileMaterialOf(material: Material, sourceOf: TextureSource): FileMaterial {
  const loaded = material as unknown as LoadedMaterial;
  const color = loaded.color ?? { r: 1, g: 1, b: 1 };
  return {
    name: loaded.name,
    color: [color.r, color.g, color.b],
    opacity: loaded.opacity,
    baseMap: useOf(loaded.map, sourceOf),
    normalMap: useOf(loaded.normalMap, sourceOf),
    alpha: alphaModeOf(loaded),
    cutoff: loaded.alphaTest > 0 ? loaded.alphaTest : DEFAULT_CUTOFF,
    doubleSided: loaded.side === DoubleSide,
  };
}

function alphaModeOf(material: LoadedMaterial): AlphaMode {
  if (material.alphaTest > 0) return 'clip';
  return material.transparent ? 'blend' : 'opaque';
}

function useOf(texture: Texture | null | undefined, sourceOf: TextureSource): TextureUse | null {
  const source = texture ? sourceOf(texture) : null;
  if (!texture || !source) return null;
  return { texture: source, repeat: [texture.repeat.x, texture.repeat.y], offset: [texture.offset.x, texture.offset.y], rotation: texture.rotation };
}
