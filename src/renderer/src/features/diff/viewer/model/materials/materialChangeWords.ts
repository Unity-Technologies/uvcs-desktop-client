// The "What changed" panel's words for a slot's material (`materialChanges`), in the terms Unity users know (material,
// texture, base map, transparent): the slot named, then briefly what changed. `changeRows` folds and lays them out.

import type { AlphaMode } from '../parsedModel';
import type { MaterialChange, Tiling } from './materialChanges';
import type { ResolvedMaterial } from './materialPlan';

export function materialWords(change: MaterialChange): { title: string; detail?: string } {
  const slot = slotName(change.slot);
  switch (change.kind) {
    case 'source':
    {
      // Two of the project's materials of one name are told apart by their folders.
      const byPath = change.before.kind === 'project' && change.after.kind === 'project' && change.before.name === change.after.name;
      if (change.after.kind === 'missing') return { title: `${slot} now shows Unity's missing material`, detail: `It's remapped to a material the project doesn't have. Was ${described(change.before, byPath)}.` };
      return { title: `${slot} now uses ${described(change.after, byPath)}`, detail: `Was ${described(change.before, byPath)}.` };
    }
    case 'baseMap':
      return { title: `${slot}: ${mapChange('base map', change.before, change.after)}` };
    case 'normalMap':
      return { title: `${slot}: ${mapChange('normal map', change.before, change.after)}` };
    case 'baseColor':
      return { title: `${slot}: base color ${change.before} → ${change.after}` };
    case 'alpha':
      return { title: `${slot}: now ${ALPHA_WORDS[change.after]}` };
    case 'cutoff':
      return { title: `${slot}: alpha cutoff ${number(change.before)} → ${number(change.after)}` };
    case 'doubleSided':
      return { title: `${slot}: now ${change.now ? 'double-sided' : 'one-sided'}` };
    case 'tiling':
      return { title: `${slot}: base map ${tilingChange(change.before, change.after)}` };
    case 'textureMissing':
      // A `.mat`'s texture the workspace hasn't is named by what it is to the slot already ("Glass's base map").
      return { title: `${change.texture.startsWith(`${change.slot}'s `) ? change.texture : `${slot}: ${change.texture}`} isn't in the workspace`, detail: 'Unity shows the material without it.' };
  }
}

/** Material changes that fold together: one kind, the same way (all now transparent, all from the project). */
export function materialFoldKey(change: MaterialChange): string {
  switch (change.kind) {
    case 'source':
      return `source:${change.after.kind}`;
    case 'alpha':
      return `alpha:${change.after}`;
    case 'doubleSided':
      return `doubleSided:${change.now}`;
    default:
      return change.kind;
  }
}

/** The row a run of one fold key makes: its title, and a detail only where it holds for every change of it. */
export function materialFoldWords(run: MaterialChange[]): { title: string; detail?: string } {
  const first = run[0]!;
  const count = run.length;
  switch (first.kind) {
    case 'source':
      return SOURCE_FOLDS[first.after.kind](count);
    case 'baseMap':
      return { title: `Base map changed on ${count} materials` };
    case 'normalMap':
      return { title: `Normal map changed on ${count} materials` };
    case 'baseColor':
      return { title: `Base color changed on ${count} materials` };
    case 'alpha':
      return { title: `${count} materials now ${ALPHA_WORDS[first.after]}` };
    case 'cutoff':
      return { title: `Alpha cutoff changed on ${count} materials` };
    case 'doubleSided':
      return { title: `${count} materials now ${first.now ? 'double-sided' : 'one-sided'}` };
    case 'tiling':
      return { title: `Base map tiling changed on ${count} materials` };
    case 'textureMissing':
      return { title: `${count} textures the materials use aren't in the workspace`, detail: 'Unity shows the materials without them.' };
  }
}

/** A change's line in a folded row: what tells it from the others of its kind. */
export function materialItemLabel(change: MaterialChange): string {
  switch (change.kind) {
    case 'source':
      return 'name' in change.after ? `${slotName(change.slot)}: ${change.after.name}` : slotName(change.slot);
    case 'alpha':
    case 'doubleSided':
      return slotName(change.slot);
    default:
      return materialWords(change).title;
  }
}

const SOURCE_FOLDS: Record<ResolvedMaterial['kind'], (count: number) => { title: string; detail?: string }> = {
  project: (count) => ({ title: `${count} slots now use the project's materials` }),
  file: (count) => ({ title: `${count} slots now use the model's own materials` }),
  default: (count) => ({ title: `${count} slots now use Unity's default material` }),
  missing: (count) => ({ title: `${count} slots now show Unity's missing material`, detail: "They're remapped to materials the project doesn't have." }),
};

/** Unity's words for a material's surface: Opaque, Cutout (alpha clipping), Transparent. */
const ALPHA_WORDS: Record<AlphaMode, string> = { opaque: 'opaque', clip: 'cutout', blend: 'transparent' };

function described(material: ResolvedMaterial, byPath = false): string {
  switch (material.kind) {
    case 'default':
      return "Unity's default material";
    case 'missing':
      return "Unity's missing material";
    case 'project':
      return `the project's ${byPath ? material.path.replace(/\.mat$/i, '') : material.name}`;
    case 'file':
      return "the model's own material";
  }
}

function mapChange(map: string, before: string | null, after: string | null): string {
  if (before === null) return `${map} ${after} added`;
  if (after === null) return `${map} ${before} removed`;
  return `${map} ${before} → ${after}`;
}

function tilingChange(before: Tiling, after: Tiling): string {
  const parts: string[] = [];
  if (before.repeat.some((value, i) => value !== after.repeat[i])) parts.push(`tiling ${before.repeat.map(number).join(' × ')} → ${after.repeat.map(number).join(' × ')}`);
  if (before.offset.some((value, i) => value !== after.offset[i])) parts.push(`offset ${before.offset.map(number).join(', ')} → ${after.offset.map(number).join(', ')}`);
  return parts.join(', ');
}

/** A glTF's material may have no name. */
function slotName(slot: string): string {
  return slot === '' ? 'An unnamed material' : slot;
}

function number(value: number): string {
  return String(Number(value.toFixed(3)));
}
