// The Materials look on the GPU: a material per slot that has a look (`SlotLook`), kept and updated in place as its
// textures decode, swapped onto each mesh's solid while the look is on (the clay materials stay for the other looks,
// and for slots Unity gives its default material). Kept when the look is turned off, so turning it on again is
// immediate; freed with the side. Lit like the clay (MeshStandardMaterial: no metal, a soft roughness, the same studio),
// so a material reads alike whatever its pipeline. A highlighted part lights up as clay does; a faded one darkens
// toward the backdrop (its color scaled down, the backdrop's added as emissive), which a texture can't be lerped to.

import { Color, DoubleSide, FrontSide, LinearMipmapLinearFilter, MeshStandardMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, type ColorSpace } from 'three';
import type { ModelScene } from '../modelScene';
import type { Side } from '../viewLayout';
import type { MapLook, SlotLook } from './materialPlan';

/** The highlighting a mesh is drawn with, as the clay's (`ModelRenderer.applyLook`). */
export interface LookEmphasis {
  lit: boolean;
  faded: boolean;
  highlight: string;
  backdrop: string;
  /** How far a faded part goes toward the backdrop. */
  fade: number;
}

const ROUGHNESS = 0.6;

export class SlotLookMaterials {
  /** By mesh, then slot: null for a slot drawn in clay. */
  private readonly materials: (MeshStandardMaterial | null)[][];

  constructor(
    private readonly model: ModelScene,
    private readonly textures: LookTextures,
  ) {
    this.materials = model.meshes.map((mesh) => mesh.slots.map(() => null));
  }

  /** The slots' looks now; a slot without one draws in clay. */
  update(looks: ReadonlyMap<string, SlotLook> | null): void {
    this.model.meshes.forEach((mesh, meshIndex) => {
      mesh.slots.forEach((slot, slotIndex) => {
        const look = looks?.get(slot);
        const current = this.materials[meshIndex]![slotIndex]!;
        if (!look) {
          if (current) disposeMaterial(current);
          this.materials[meshIndex]![slotIndex] = null;
          return;
        }
        const clay = mesh.clay[slotIndex]!;
        const material = current ?? new MeshStandardMaterial({ name: slot, metalness: 0, roughness: ROUGHNESS, polygonOffset: clay.polygonOffset, polygonOffsetFactor: clay.polygonOffsetFactor, polygonOffsetUnits: clay.polygonOffsetUnits });
        this.materials[meshIndex]![slotIndex] = material;
        this.apply(material, look);
      });
    });
  }

  /** Puts the mesh's look materials on its solid, or its clay ones back, with the emphasis of the clay's. */
  show(meshIndex: number, on: boolean, emphasis: LookEmphasis | null): void {
    const mesh = this.model.meshes[meshIndex]!;
    const looks = this.materials[meshIndex]!;
    const anyLook = looks.some((material) => material !== null);
    mesh.solid.material = on && anyLook ? looks.map((material, slot) => material ?? mesh.clay[slot]!) : mesh.clay;
    if (!on || !emphasis) return;
    for (const material of looks) {
      if (!material) continue;
      const base = material.userData.color as Color;
      material.color.copy(emphasis.faded ? base.clone().multiplyScalar(1 - emphasis.fade) : base);
      material.emissive.set(emphasis.lit ? emphasis.highlight : emphasis.faded ? emphasis.backdrop : 0x000000);
      material.emissiveIntensity = emphasis.lit ? 0.35 : emphasis.faded ? emphasis.fade : 0;
    }
  }

  dispose(): void {
    for (const meshMaterials of this.materials) for (const material of meshMaterials) if (material) disposeMaterial(material);
  }

  private apply(material: MeshStandardMaterial, look: SlotLook): void {
    material.userData.color = new Color(...look.color);
    const before = programKey(material);
    material.map = this.textureFor(material.map, look.baseMap, SRGBColorSpace);
    material.normalMap = this.textureFor(material.normalMap, look.normalMap, NoColorSpace);
    material.alphaTest = look.alpha === 'clip' ? look.cutoff : 0;
    material.transparent = look.alpha === 'blend';
    material.depthWrite = look.alpha !== 'blend';
    material.opacity = look.alpha === 'blend' ? look.opacity : 1;
    material.side = look.doubleSided ? DoubleSide : FrontSide;
    if (programKey(material) !== before) material.needsUpdate = true;
  }

  /** The material's texture for a map: its own copy of the shared one, carrying its tiling; the old copy let go. */
  private textureFor(current: Texture | null, map: MapLook | null, colorSpace: ColorSpace): Texture | null {
    const key = map && LookTextures.keyOf(map.key, colorSpace);
    if (current && current.userData.key !== key) current.dispose();
    if (!map || !key) return null;
    const texture = current?.userData.key === key ? current : this.textures.get(map, colorSpace).clone();
    texture.userData.key = key;
    texture.repeat.set(...map.repeat);
    texture.offset.set(...map.offset);
    texture.rotation = map.rotation;
    return texture;
  }
}

/** What makes three compile another shader for a material. */
function programKey(material: MeshStandardMaterial): string {
  return [material.map !== null, material.normalMap !== null, material.alphaTest > 0, material.transparent, material.side].join();
}

function disposeMaterial(material: MeshStandardMaterial): void {
  material.map?.dispose();
  material.normalMap?.dispose();
  material.dispose();
}

/**
 * One GPU texture per decoded bitmap and use (a base map's sRGB, a normal map's linear data), shared by the sides and
 * slots through copies, which share its upload. A texture no look uses anymore is freed (`keepOnly`).
 */
export class LookTextures {
  private readonly textures = new Map<string, Texture>();

  constructor(private readonly anisotropy: number) {}

  static keyOf(key: string, colorSpace: ColorSpace): string {
    return `${colorSpace}\0${key}`;
  }

  get(map: MapLook, colorSpace: ColorSpace): Texture {
    const key = LookTextures.keyOf(map.key, colorSpace);
    let texture = this.textures.get(key);
    if (!texture) {
      // The bitmap is already the right way up (`decodeTexture`): WebGL can't flip a bitmap as it uploads it.
      texture = new Texture(map.bitmap);
      texture.flipY = false;
      texture.colorSpace = colorSpace;
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = this.anisotropy;
      texture.needsUpdate = true;
      this.textures.set(key, texture);
    }
    return texture;
  }

  /** Frees the textures neither side's looks use. */
  keepOnly(looks: Record<Side, ReadonlyMap<string, SlotLook> | null>): void {
    const used = new Set<string>();
    for (const sideLooks of [looks.before, looks.after]) {
      for (const look of sideLooks?.values() ?? []) {
        if (look.baseMap) used.add(LookTextures.keyOf(look.baseMap.key, SRGBColorSpace));
        if (look.normalMap) used.add(LookTextures.keyOf(look.normalMap.key, NoColorSpace));
      }
    }
    for (const [key, texture] of this.textures) {
      if (used.has(key)) continue;
      texture.dispose();
      this.textures.delete(key);
    }
  }

  dispose(): void {
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}
