// What changed in the materials a model file defines, slot by slot, for where Unity's own can't be resolved at all
// (`whatChanged`: no point to look them up at, or no Unity project): a base color, alpha, sides or tiling the file
// changed, told in `materialChanges`' terms so the panel words them alike. Which textures a slot maps is left to the
// textures the model names (`modelChanges`' `textures`), which also frame the meshes that show them.

import type { FileMaterial, ParsedModel, TextureUse } from '../parsedModel';
import { hexOf, percentOf, type MaterialChange } from './materialChanges';

type MaterialsOf = Pick<ParsedModel, 'format' | 'meshes' | 'materials'>;

/** Each named slot both versions have, in the version after's order. A slot named nothing pairs with nothing. */
export function fileMaterialChanges(before: MaterialsOf, after: MaterialsOf): MaterialChange[] {
  const was = materialsBySlot(before);
  return [...materialsBySlot(after)].flatMap(([slot, now]) => {
    const old = was.get(slot);
    return old ? changesOf(slot, old, now, after.format === 'gltf' || after.format === 'glb') : [];
  });
}

/** The material of each slot some triangle uses, by the slot's name (as Unity names its materials), the first of a name. */
function materialsBySlot({ meshes, materials }: MaterialsOf): Map<string, FileMaterial> {
  const bySlot = new Map<string, FileMaterial>();
  for (const mesh of meshes) {
    mesh.slots.forEach((slot, i) => {
      const material = materials[mesh.slotMaterials[i] ?? -1];
      const used = mesh.groups.some((group) => group.slot === i && group.count > 0);
      if (material && used && slot !== '' && !bySlot.has(slot)) bySlot.set(slot, material);
    });
  }
  return bySlot;
}

/** `tinted`: a glTF's color tints its base map (glTFast); Unity's ModelImporter drops an FBX's under one. */
function changesOf(slot: string, was: FileMaterial, now: FileMaterial, tinted: boolean): MaterialChange[] {
  const changes: MaterialChange[] = [];
  const colorShows = tinted || (!was.baseMap && !now.baseMap);
  const [colorBefore, colorAfter] = [hexOf(was.color), hexOf(now.color)];
  if (colorShows && colorBefore !== colorAfter) changes.push({ kind: 'baseColor', slot, before: colorBefore, after: colorAfter });
  if (was.alpha !== now.alpha) changes.push({ kind: 'alpha', slot, before: was.alpha, after: now.alpha });
  else if (was.alpha === 'clip' && was.cutoff !== now.cutoff) changes.push({ kind: 'cutoff', slot, before: was.cutoff, after: now.cutoff });
  else if (was.alpha === 'blend' && percentOf(was.opacity) !== percentOf(now.opacity)) changes.push({ kind: 'opacity', slot, before: was.opacity, after: now.opacity });
  if (was.doubleSided !== now.doubleSided) changes.push({ kind: 'doubleSided', slot, now: now.doubleSided });
  if (was.baseMap && now.baseMap && !sameTiling(was.baseMap, now.baseMap)) changes.push({ kind: 'tiling', slot, before: tilingOf(was.baseMap), after: tilingOf(now.baseMap) });
  return changes;
}

function sameTiling(a: TextureUse, b: TextureUse): boolean {
  return [...a.repeat, ...a.offset].every((value, i) => value === [...b.repeat, ...b.offset][i]);
}

function tilingOf({ repeat, offset }: TextureUse): { repeat: [number, number]; offset: [number, number] } {
  return { repeat, offset };
}
