import type { ModelFormat } from '@shared/domain/content';
import type { ModelMesh } from '../parsedModel';

/**
 * What each of a mesh's slots is to the Materials look: its name where Unity matches materials by name (an FBX's or
 * an OBJ's: the `.meta`'s remaps, the `.mtl`), its material where glTFast takes each of the file's materials as it
 * is (a glTF's materials may share a name, or have none: Sponza's 25 are all unnamed).
 */
export function slotKeysOf(format: ModelFormat, mesh: Pick<ModelMesh, 'slots' | 'slotMaterials'>): string[] {
  const byMaterial = format === 'gltf' || format === 'glb';
  return mesh.slots.map((name, i) => {
    const material = mesh.slotMaterials[i] ?? -1;
    return byMaterial && material >= 0 ? `#${material}` : name;
  });
}
