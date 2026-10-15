// The "What changed" panel's rows: each change in a few plain words, and for what loses work in Unity a line on why
// (what binds to the name, what every scene will show). Long runs of one kind (six bones added) fold into one row
// listing them. Unity's words where Unity users use them (GameObject, prefab, material slot, blendshape, pivot);
// never the file format's.

import { formatCount } from '../../../../lib/text';
import { formatLength, formatUnits } from './modelUnits';
import type { ModelChange, NodeRef } from './modelChanges';
import { isRisk } from './modelChanges';
import type { NotKnownReason } from './materials/materialComparison';
import { materialFoldKey, materialFoldWords, materialItemLabel, materialWords } from './materials/materialChangeWords';

export interface ChangeRow {
  /** Stable for the change: a key for the list and for the row picked. */
  id: string;
  tone: 'risk' | 'note';
  title: string;
  /** Why it matters in Unity. */
  detail?: string;
  /** What to frame and light up when the row is picked. */
  focus: NodeRef[];
  /** A folded run of one kind of change: a line for each. */
  items?: { label: string; focus: NodeRef[]; take?: string }[];
  /** The take to play when the row is picked: what changed shows only as it plays. */
  take?: string;
}

/** From this many changes of one kind, they fold into one row. */
const FOLD_FROM = 3;

export function changeRows(changes: ModelChange[]): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const folded = new Set<string>();
  changes.forEach((change, index) => {
    const fold = foldKey(change);
    if (fold && folded.has(fold)) return;
    const run = fold ? changes.filter((other) => foldKey(other) === fold) : [];
    if (fold && run.length >= FOLD_FROM) {
      folded.add(fold);
      rows.push(foldedRow(fold, run));
      return;
    }
    rows.push({ id: `${change.kind}:${index}`, tone: isRisk(change) ? 'risk' : 'note', ...wordsOf(change), focus: focusOf(change), ...takeOf(change) });
  });
  return rows;
}

/** The take a row picked, or one of its items (`item`), plays: what changed in it shows only as it plays. */
export function takeOfPick(row: ChangeRow, item?: number): string | null {
  return (item === undefined ? row.take : row.items?.[item]?.take) ?? null;
}

/** Changes that fold together: one kind, on nodes of one family, the same way (lightmap UVs gained, not lost). */
function foldKey(change: ModelChange): string | null {
  switch (change.kind) {
    case 'renamed':
    case 'moved':
    case 'removed':
    case 'added':
      return `${change.kind}:${family(change.node)}`;
    case 'triangles':
    case 'shape':
    case 'triangulation':
    case 'facesFlipped':
    case 'faceSlots':
    case 'normals':
    case 'uvs':
    case 'skinning':
    case 'meshSlots':
    case 'vertexColorsChanged':
      return change.kind;
    case 'lightmapUvs':
    case 'vertexColors':
      return `${change.kind}:${change.now}`;
    case 'avatarBoneLost':
    case 'clipKeys':
      return change.kind;
    case 'material':
      return `material:${materialFoldKey(change.change)}`;
    default:
      return null;
  }
}

function foldedRow(key: string, run: ModelChange[]): ChangeRow {
  const first = run[0]!;
  const count = run.length;
  const items = run.map((change) => ({ label: itemLabel(change), focus: focusOf(change), ...takeOf(change) }));
  if (first.kind === 'material') {
    const words = materialFoldWords(run.flatMap((change) => (change.kind === 'material' ? [change.change] : [])));
    return { id: `fold:${key}`, tone: isRisk(first) ? 'risk' : 'note', ...words, focus: run.flatMap(focusOf), items };
  }
  const noun = 'node' in first ? plural(family(first.node), count) : 'meshes';
  const titles: Partial<Record<ModelChange['kind'], string>> = {
    renamed: `Renamed ${count} ${noun}`,
    moved: `Moved ${count} ${noun} to other parents`,
    removed: `Removed ${count} ${noun}`,
    added: `Added ${count} ${noun}`,
    triangles: `Triangles changed on ${count} meshes`,
    shape: `${count} meshes changed shape`,
    triangulation: `${count} meshes triangulated differently`,
    facesFlipped: `Faces flipped on ${count} meshes`,
    faceSlots: `Faces use other materials on ${count} meshes`,
    normals: `Normals changed on ${count} meshes`,
    uvs: `UVs changed on ${count} meshes`,
    vertexColorsChanged: `Vertex colors changed on ${count} meshes`,
    skinning: `Skinning changed on ${count} meshes`,
    meshSlots: `${count} meshes use other material slots`,
    avatarBoneLost: `The Humanoid avatar lost ${count} of its bones`,
    clipKeys: `${count} animations changed`,
    lightmapUvs: first.kind === 'lightmapUvs' && first.now ? `${count} meshes have lightmap UVs now` : `${count} meshes lost their lightmap UVs`,
    vertexColors: first.kind === 'vertexColors' && first.now ? `${count} meshes have vertex colors now` : `${count} meshes lost their vertex colors`,
  };
  return {
    id: `fold:${key}`,
    tone: isRisk(first) ? 'risk' : 'note',
    title: titles[first.kind]!,
    ...(wordsOf(first).detail !== undefined && { detail: wordsOf(first).detail }),
    focus: run.flatMap(focusOf),
    items,
  };
}

/** A change's line in a folded row: what tells it from the others of its kind. */
function itemLabel(change: ModelChange): string {
  switch (change.kind) {
    case 'renamed':
      return `${change.from} → ${change.node.name}`;
    case 'moved':
      return `${change.node.name}: ${parentPathOf(change.fromPath)} → ${parentPathOf(change.node.path)}`;
    case 'triangles':
      return `${change.node.name}: ${formatCount(change.before)} → ${formatCount(change.after)}`;
    case 'meshSlots':
      return `${change.node.name}: ${change.before.join(', ')} → ${change.after.join(', ')}`;
    case 'avatarBoneLost':
      return `${change.humanName} → ${change.boneName}`;
    case 'clipKeys':
      return change.nodes.length > 0 ? `${change.name}: ${namesOf(change.nodes)}` : change.name;
    case 'material':
      return materialItemLabel(change.change);
    default:
      return 'node' in change ? change.node.name : change.kind;
  }
}

function wordsOf(change: ModelChange): { title: string; detail?: string } {
  switch (change.kind) {
    case 'resized': {
      const bigger = change.factor >= 1;
      const factor = factorOf(bigger ? change.factor : 1 / change.factor);
      const cause =
        change.cause?.kind === 'units'
          ? `The file's units changed from ${formatUnits(change.cause.before)} to ${formatUnits(change.cause.after)}. `
          : change.cause?.kind === 'importSettings'
            ? 'Its import settings scale it differently. '
            : '';
      return {
        title: `${factor}× ${bigger ? 'larger' : 'smaller'} in Unity`,
        detail: `${cause}It was ${formatLength(change.heightBefore)} tall, now ${formatLength(change.heightAfter)}, in every scene that uses it.`,
      };
    }
    case 'unitsChanged':
      return { title: `Units changed from ${formatUnits(change.before)} to ${formatUnits(change.after)}`, detail: 'Its size in Unity is the same.' };
    case 'turned':
      return { title: `Turned ${change.degrees}°${change.axis ? ` around ${change.axis}` : ''}`, detail: 'Every scene that uses it shows it turned.' };
    case 'offPivot':
      return { title: `Moved ${formatLength(change.distance)} off its pivot`, detail: 'Every scene that uses it shows it moved by as much.' };
    case 'pivotMoved':
      return {
        title: `${change.node.name}'s pivot moved ${formatLength(change.distance)}`,
        detail: 'It looks the same, but it turns and scales around another point, in animations too.',
      };
    case 'renamed':
      return {
        title: `Renamed ${change.from} to ${change.node.name}`,
        detail: change.node.kind === 'bone' ? 'The avatar and animations bind bones by name: they lose it.' : 'Prefab overrides, animations and scripts that find it by name lose it.',
      };
    case 'moved':
      return {
        title: `Moved ${change.node.name} under ${nameOfParent(change.node.path)}`,
        detail: `Animations and scripts that find it by its path (${change.fromPath}) lose it.`,
      };
    case 'removed':
      return {
        title: `Removed ${change.node.name}`,
        detail: change.node.kind === 'bone' ? 'The avatar and animations that move it lose it.' : 'Prefab overrides and references to it are lost.',
      };
    case 'added':
      return { title: `Added ${change.node.name}` };
    case 'transformed':
      return { title: `Moved, turned or scaled: ${change.nodes.map((node) => node.name).join(', ')}` };
    case 'slotRenamed':
      return {
        title: `Material slot ${change.from} is now ${change.to}`,
        detail: "Unity remaps materials by slot name: the material set for the old name isn't used anymore.",
      };
    case 'slotRemoved':
      return { title: `Removed material slot ${change.slot}`, detail: 'The material remapped to it is no longer used.' };
    case 'slotAdded':
      return { title: `New material slot ${change.slot}`, detail: "Remap a material to it in the model's import settings." };
    case 'meshSlots':
      return { title: `${change.node.name} uses other material slots`, detail: `${change.before.join(', ')} → ${change.after.join(', ')}` };
    case 'triangles':
      return { title: `${change.node.name}: ${formatCount(change.before)} → ${formatCount(change.after)} triangles` };
    case 'shape':
      return { title: `${change.node.name}'s shape changed` };
    case 'triangulation':
      return { title: `${change.node.name} is triangulated differently`, detail: 'Its vertices are where they were.' };
    case 'faceSlots':
      return { title: `Some of ${change.node.name}'s faces use another material` };
    case 'facesFlipped':
      return { title: `Some of ${change.node.name}'s faces flipped`, detail: 'Unity draws a face from its front only: those now show from the other side.' };
    case 'normals':
      return { title: `${change.node.name}'s normals changed`, detail: 'Its shading looks different.' };
    case 'uvs':
      return { title: `${change.node.name}'s UVs changed`, detail: 'Textures map onto it differently.' };
    case 'lightmapUvs':
      return change.now
        ? { title: `${change.node.name} has lightmap UVs now` }
        : { title: `${change.node.name} lost its lightmap UVs`, detail: 'Baked lighting needs them: export them again or turn on Generate Lightmap UVs.' };
    case 'vertexColors':
      return { title: change.now ? `${change.node.name} has vertex colors now` : `${change.node.name} lost its vertex colors` };
    case 'vertexColorsChanged':
      return { title: `${change.node.name}'s vertex colors changed` };
    case 'blendShapesChanged':
      return {
        title: change.names.length === 1 ? `Blendshape ${change.names[0]} on ${change.node.name} changed` : `Blendshapes changed on ${change.node.name}: ${listed(change.names)}`,
      };
    case 'skinning':
      return { title: `${change.node.name}'s skinning changed`, detail: 'It bends differently in animations.' };
    case 'blendShapeRenamed':
      return { title: `Blendshape ${change.from} on ${change.node.name} is now ${change.to}`, detail: 'Animations and scripts that set it by name stop working.' };
    case 'blendShapeRemoved':
      return { title: `Removed blendshape ${change.name} from ${change.node.name}`, detail: 'Animations and scripts that set it stop working.' };
    case 'blendShapeAdded':
      return { title: `New blendshape ${change.name} on ${change.node.name}` };
    case 'clipRenamed':
      return { title: `Animation ${change.from} is now ${change.to}`, detail: 'Clips Unity cuts from the old take lose their source.' };
    case 'clipRemoved':
      return { title: `Removed animation ${change.name}`, detail: 'The clips Unity cut from it are gone.' };
    case 'clipAdded':
      return { title: `New animation ${change.name}` };
    case 'clipLength':
      return { title: `Animation ${change.name}: ${seconds(change.before)} → ${seconds(change.after)}`, detail: 'Clips cut from it by frames may no longer fit.' };
    case 'clipKeys':
      return { title: change.nodes.length > 0 ? `Animation ${change.name} changed: ${namesOf(change.nodes)}` : `Animation ${change.name} changed` };
    case 'textures':
      return { title: texturesTitle(change.added, change.removed) };
    case 'embeddedTextures':
      return {
        title: change.names.length === 1 ? `Texture ${change.names[0]} changed` : `${change.names.length} textures changed: ${change.names.join(', ')}`,
        detail: 'Show materials and textures to see it.',
      };
    case 'upAxis':
      return { title: `Exported ${change.after}-up, was ${change.before}-up`, detail: 'Unity stands it on Y either way.' };
    case 'exporter':
      return { title: exporterTitle(change.before, change.after) };
    case 'scaleFactor':
      return { title: scaleSettingsTitle(change.before, change.after), detail: 'Every scene that uses it shows it at the new size.' };
    case 'remapLost':
      return { title: `The material remapped to ${change.slot} isn't used`, detail: `The model has no ${change.slot} slot anymore: remap a material to its new slot in the import settings.` };
    case 'avatarBoneLost':
      return {
        title: `The Humanoid avatar maps ${change.humanName} to ${change.boneName}, which is gone`,
        detail: 'Animations on the avatar lose that bone until it is mapped again in the import settings.',
      };
    case 'clipPastTake':
      return {
        title: `Clip ${change.clip} ends at frame ${change.lastFrame}, past its take's ${change.takeFrames} frames`,
        detail: 'Unity holds the last frame for the rest: shorten the clip in the import settings.',
      };
    case 'material':
      return materialWords(change.change);
    case 'materialsNotCompared':
      return { title: 'Materials not compared', detail: NOT_COMPARED_WORDS[change.reason] };
    case 'clipTakeLost':
      return { title: `Clip ${change.clip} is cut from the take ${change.take}, which is gone`, detail: 'Unity imports no clip from it until it is cut from a take the model has.' };
  }
}

const NOT_COMPARED_WORDS: Record<NotKnownReason, string> = {
  noLibrary: 'Open the project in Unity once on this computer to compare them.',
  unread: "The project's files couldn't all be read.",
  noProject: "The model isn't in a Unity project.",
  outsidePackage: "The project uses a package from a folder outside it, which isn't read.",
};

function scaleSettingsTitle(before: { scaleFactor: number; convertUnits: boolean }, after: { scaleFactor: number; convertUnits: boolean }): string {
  if (before.convertUnits !== after.convertUnits && before.scaleFactor === after.scaleFactor) return `Convert Units turned ${after.convertUnits ? 'on' : 'off'} in the import settings`;
  const units = before.convertUnits !== after.convertUnits ? `, Convert Units ${after.convertUnits ? 'on' : 'off'}` : '';
  return `Scale Factor in the import settings: ${before.scaleFactor} → ${after.scaleFactor}${units}`;
}

/** A take's row plays it. Its nodes aren't its focus: a bone's dot marks where it rests, while the take moves it. */
function takeOf(change: ModelChange): { take?: string } {
  return change.kind === 'clipKeys' ? { take: change.name } : {};
}

/** The first few nodes' names, and how many more: a clue of where to look, not a list. */
function namesOf(nodes: NodeRef[]): string {
  return listed(nodes.map((node) => node.name));
}

function listed(names: string[]): string {
  const shown = names.slice(0, NAMED);
  const more = names.length - shown.length;
  return more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ');
}

const NAMED = 3;

function focusOf(change: ModelChange): NodeRef[] {
  if ('node' in change) return [change.node];
  if (change.kind === 'transformed' || change.kind === 'textures' || change.kind === 'embeddedTextures' || change.kind === 'material') return change.nodes;
  return [];
}

/** Bones, meshes and the rest (empties, lights, cameras): GameObjects. */
function family(node: NodeRef): 'bone' | 'mesh' | 'GameObject' {
  if (node.kind === 'bone') return 'bone';
  return node.kind === 'mesh' || node.kind === 'skinnedMesh' ? 'mesh' : 'GameObject';
}

function plural(noun: 'bone' | 'mesh' | 'GameObject', count: number): string {
  if (count === 1) return noun;
  return noun === 'mesh' ? 'meshes' : `${noun}s`;
}

function parentPathOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? 'the root' : path.slice(0, slash);
}

function nameOfParent(path: string): string {
  const parent = parentPathOf(path);
  return parent === 'the root' ? parent : parent.slice(parent.lastIndexOf('/') + 1);
}

function factorOf(value: number): string {
  return value >= 10 ? String(Math.round(value)) : String(Number(value.toFixed(2)));
}

function seconds(value: number): string {
  return `${Number(value.toFixed(2))} s`;
}

function texturesTitle(added: string[], removed: string[]): string {
  if (removed.length === 0) return `Uses new textures: ${added.join(', ')}`;
  if (added.length === 0) return `No longer uses textures: ${removed.join(', ')}`;
  return `Textures changed: ${removed.join(', ')} → ${added.join(', ')}`;
}

function exporterTitle(before: string | null, after: string | null): string {
  if (!after) return `Exported by another app, was ${before}`;
  return before ? `Exported from ${after}, was ${before}` : `Exported from ${after}`;
}
