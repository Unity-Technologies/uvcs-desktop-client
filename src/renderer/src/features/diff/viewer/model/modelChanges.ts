// What changed between two versions of a model, as Unity will take it: the export mistakes that break a project
// without an error (a model 100× too big, turned on its back, off its pivot; a GameObject, bone, material slot,
// blendshape or take renamed, which loses everything bound to it by name) and what a budget or a look depends on
// (triangles, shape, normals, UVs, skinning). Plain facts, in the order a person should read them; the panel's words
// are `modelChangeWords`'. A model-wide change is told once, from what every matched mesh agrees on, and not again
// for each node it moved.

import { Matrix4, Quaternion, Vector3 } from 'three';
import type { ModelNodeKind } from './parsedModel';
import type { Bounds, MeshSummary, ModelSummary, SummaryNode } from './modelSummary';
import type { TakeTrack } from './takeTracks';
import { matchNodes, type NodeMatching } from './nodeMatching';
import { isMaterialRisk, type MaterialChange } from './materials/materialChanges';
import type { NotKnownReason } from './materials/materialComparison';

/** A node a change is about, on the sides it is on: `before` and `after` are node keys, for framing it. */
export interface NodeRef {
  name: string;
  path: string;
  kind: ModelNodeKind;
  before?: string;
  after?: string;
}

export type ModelChange =
  /** Every mesh grew or shrank by `factor`; `cause` when the file's units or its import settings changed with it. */
  | { kind: 'resized'; factor: number; heightBefore: number; heightAfter: number; cause: ResizeCause | null }
  /** The file's units changed and the model kept its size in Unity. */
  | { kind: 'unitsChanged'; before: number; after: number }
  /** Every mesh turned by the same rotation; `axis` when it is about one of Unity's. */
  | { kind: 'turned'; degrees: number; axis: 'X' | 'Y' | 'Z' | null }
  /** Every mesh moved by the same distance from the model's pivot, in metres. */
  | { kind: 'offPivot'; distance: number }
  /** A node moved and its geometry didn't: it turns and scales around another point. */
  | { kind: 'pivotMoved'; node: NodeRef; distance: number }
  | { kind: 'renamed'; node: NodeRef; from: string }
  | { kind: 'moved'; node: NodeRef; fromPath: string }
  | { kind: 'removed'; node: NodeRef }
  | { kind: 'added'; node: NodeRef }
  /** Nodes whose own position, rotation or scale changed. */
  | { kind: 'transformed'; nodes: NodeRef[] }
  | { kind: 'slotRenamed'; from: string; to: string }
  | { kind: 'slotRemoved'; slot: string }
  | { kind: 'slotAdded'; slot: string }
  | { kind: 'meshSlots'; node: NodeRef; before: string[]; after: string[] }
  | { kind: 'triangles'; node: NodeRef; before: number; after: number }
  | { kind: 'shape'; node: NodeRef }
  /** The same vertices made into other triangles (a quad split along its other diagonal): no vertex moved. */
  | { kind: 'triangulation'; node: NodeRef }
  /** The same triangles, some turning the other way: Unity draws them from what was their back. */
  | { kind: 'facesFlipped'; node: NodeRef }
  | { kind: 'normals'; node: NodeRef }
  | { kind: 'uvs'; node: NodeRef }
  | { kind: 'lightmapUvs'; node: NodeRef; now: boolean }
  | { kind: 'vertexColors'; node: NodeRef; now: boolean }
  /** Vertex colors on both versions, painted otherwise. */
  | { kind: 'vertexColorsChanged'; node: NodeRef }
  /** Blendshapes both versions have by name whose offsets changed: the shape a face makes. */
  | { kind: 'blendShapesChanged'; node: NodeRef; names: string[] }
  | { kind: 'skinning'; node: NodeRef }
  | { kind: 'blendShapeRenamed'; node: NodeRef; from: string; to: string }
  | { kind: 'blendShapeRemoved'; node: NodeRef; name: string }
  | { kind: 'blendShapeAdded'; node: NodeRef; name: string }
  | { kind: 'clipRenamed'; from: string; to: string }
  | { kind: 'clipRemoved'; name: string }
  | { kind: 'clipAdded'; name: string }
  | { kind: 'clipLength'; name: string; before: number; after: number }
  /** A take of the same name and length whose keys changed, and the nodes it keys differently (parents first). */
  | { kind: 'clipKeys'; name: string; nodes: NodeRef[] }
  /** Textures the materials name, or a glTF holds, now and no longer, and the meshes that show them. */
  | { kind: 'textures'; added: string[]; removed: string[]; nodes: NodeRef[] }
  /** Textures a glTF holds whose pixels changed under their names, and the meshes that show them. */
  | { kind: 'embeddedTextures'; names: string[]; nodes: NodeRef[] }
  | { kind: 'upAxis'; before: string; after: string }
  /** What the model's import settings (`importSettingsChanges`) do with it now, and no longer fits it. */
  | { kind: 'scaleFactor'; before: ScaleSettings; after: ScaleSettings }
  | { kind: 'remapLost'; slot: string }
  | { kind: 'avatarBoneLost'; humanName: string; boneName: string }
  | { kind: 'clipPastTake'; clip: string; take: string; lastFrame: number; takeFrames: number }
  | { kind: 'clipTakeLost'; clip: string; take: string }
  | { kind: 'exporter'; before: string | null; after: string | null }
  /** What changed in a slot's material as Unity resolves it (`materialChanges`). */
  | { kind: 'material'; change: MaterialChange; nodes: NodeRef[] }
  /** Materials that may have changed but couldn't be compared, and why (`materialsNotComparedOf`). */
  | { kind: 'materialsNotCompared'; reason: NotKnownReason };

export type ModelChangeKind = ModelChange['kind'];

/** The import settings that scale a model in Unity. */
export interface ScaleSettings {
  scaleFactor: number;
  convertUnits: boolean;
}

/** Why a model's size changed in Unity: the file's units (metres per unit), or its import settings' scale. */
export type ResizeCause = { kind: 'units'; before: number; after: number } | { kind: 'importSettings'; before: number; after: number };

/** A change that loses work or breaks a scene in Unity, which the panel tells first, in the attention tone. */
export function isRisk(change: ModelChange): boolean {
  switch (change.kind) {
    case 'resized':
    case 'turned':
    case 'offPivot':
    case 'renamed':
    case 'moved':
    case 'removed':
    case 'slotRenamed':
    case 'slotRemoved':
    case 'blendShapeRenamed':
    case 'blendShapeRemoved':
    case 'clipRenamed':
    case 'clipRemoved':
    case 'remapLost':
    case 'avatarBoneLost':
    case 'clipPastTake':
    case 'clipTakeLost':
      return true;
    case 'lightmapUvs':
      return !change.now;
    case 'material':
      return isMaterialRisk(change.change);
    default:
      return false;
  }
}

/** Below these, a change is a re-export's rounding. */
const SCALE_TOLERANCE = 0.01;
const TURN_TOLERANCE_DEGREES = 0.5;
const DISTANCE_TOLERANCE_METRES = 0.001;
const DURATION_TOLERANCE_SECONDS = 0.001;

export function modelChanges(before: ModelSummary, after: ModelSummary): ModelChange[] {
  const matching = matchNodes(before, after);
  const pairs = matchedMeshes(before, after, matching);
  const whole = wholeModelChanges(before, after, pairs);
  const transforms = transformChanges(before, after, matching, whole.length > 0);
  // A pivot moved shifts the vertices the other way, to stay where they were; a model resized or moved off its pivot
  // moved them all alike: no shape changed.
  const pivotsMoved = new Set(transforms.flatMap((change) => (change.kind === 'pivotMoved' ? [change.node.after!] : [])));
  const verticesExplained = whole.some((change) => change.kind === 'resized' || change.kind === 'offPivot');
  const changes: ModelChange[] = [
    ...whole,
    ...hierarchyChanges(before, after, matching),
    ...transforms,
    ...slotChanges(pairs),
    ...pairs.flatMap((pair) => meshChanges(pair, verticesExplained || pivotsMoved.has(pair.ref.after!))),
    ...clipChanges(before, after, matching),
    ...textureChanges(before, after, matching),
  ];
  if (before.unitScale !== after.unitScale && !changes.some((change) => change.kind === 'resized')) {
    changes.push({ kind: 'unitsChanged', before: before.unitScale, after: after.unitScale });
  }
  if (before.upAxis !== after.upAxis) changes.push({ kind: 'upAxis', before: before.upAxis.toUpperCase(), after: after.upAxis.toUpperCase() });
  if (before.exportedFrom !== after.exportedFrom) changes.push({ kind: 'exporter', before: before.exportedFrom, after: after.exportedFrom });
  return [...changes.filter(isRisk), ...changes.filter((change) => !isRisk(change))];
}

/**
 * The meshes whose triangles use a material slot, by its name: as the version after has them, and those of the
 * version before that are gone since. What a material's row frames.
 */
export function meshesUsingSlot(before: ModelSummary, after: ModelSummary): (slot: string) => NodeRef[] {
  let matching: NodeMatching | null = null;
  const using = (summary: ModelSummary, slot: string) => summary.nodes.flatMap((node, i) => (node.mesh !== null && summary.meshes[node.mesh]!.slots.includes(slot) ? [i] : []));
  return (slot) => {
    matching ??= matchNodes(before, after);
    const { afterOf, beforeOf } = matching;
    const now = using(after, slot).map((a) => refOf(after.nodes[a], before.nodes[beforeOf[a]!]));
    const gone = using(before, slot).filter((b) => afterOf[b] === -1).map((b) => refOf(undefined, before.nodes[b]));
    return [...now, ...gone];
  };
}

/** A mesh on both sides, with its nodes. */
interface MeshPair {
  before: MeshSummary;
  after: MeshSummary;
  nodeBefore: SummaryNode;
  nodeAfter: SummaryNode;
  ref: NodeRef;
}

function matchedMeshes(before: ModelSummary, after: ModelSummary, matching: NodeMatching): MeshPair[] {
  return before.nodes.flatMap((nodeBefore, b) => {
    const a = matching.afterOf[b]!;
    const nodeAfter = a === -1 ? undefined : after.nodes[a]!;
    if (!nodeAfter || nodeBefore.mesh === null || nodeAfter.mesh === null) return [];
    return [{ before: before.meshes[nodeBefore.mesh]!, after: after.meshes[nodeAfter.mesh]!, nodeBefore, nodeAfter, ref: refOf(nodeAfter, nodeBefore) }];
  });
}

function refOf(after: SummaryNode | undefined, before: SummaryNode | undefined): NodeRef {
  const node = (after ?? before)!;
  return { name: node.name || '(root)', path: node.path, kind: node.kind, ...(before && { before: before.key }), ...(after && { after: after.key }) };
}

/**
 * Resized, turned, moved off its pivot: told when every matched mesh moved the same way in Unity's space. A turn and
 * a scale are read from the meshes' placement; a scale applied to the vertices (Blender's "Apply Scale") and a move
 * off the pivot (geometry moved, the model's origin not) from where the geometry went. Rigid meshes tell that; a
 * skinned mesh's geometry goes where its bones hold it, so it tells nothing alone (a bone moved is told as the bone,
 * `transformChanges`), but it must agree: a hat scaled beside a body that stayed is no resize.
 */
function wholeModelChanges(before: ModelSummary, after: ModelSummary, pairs: MeshPair[]): ModelChange[] {
  const drawn = pairs.filter((pair) => pair.nodeBefore.bounds && pair.nodeAfter.bounds);
  if (drawn.length === 0) return [];
  const motions = drawn.map(motionOf);
  // Where the geometry went tells a resize or a move only for meshes still made the same way: subdividing or
  // sculpting one moves its bounds too.
  const sameTopology = drawn.map(({ before, after }) => before.triangles === after.triangles && before.fingerprints.index === after.fingerprints.index);
  const isSkinned = drawn.map((pair) => pair.before.skinned || pair.after.skinned);
  const rigid = motions.filter((_, i) => !isSkinned[i]);
  const geometric = motions.filter((_, i) => !isSkinned[i] && sameTopology[i]);
  const skinnedAlike = motions.filter((_, i) => isSkinned[i] && sameTopology[i]);
  const geometryTells = rigid.length > 0 && geometric.length === rigid.length;
  /** What the rigid meshes' geometry agrees on, when every skinned mesh made the same way agrees too. */
  const agreed = <T>(value: (motion: Motion) => T, close: (a: T, b: T) => boolean): T | undefined => {
    const told = geometryTells ? shared(geometric.map(value), close) : undefined;
    return told !== undefined && skinnedAlike.every((motion) => close(value(motion), told)) ? told : undefined;
  };
  const rotation = shared(motions.map((motion) => motion.rotation), (a, b) => a.angleTo(b) <= radians(TURN_TOLERANCE_DEGREES));
  const unturned = rotation !== undefined && rotation.angleTo(new Quaternion()) <= radians(TURN_TOLERANCE_DEGREES);
  const placementScale = shared(motions.map((motion) => motion.placementScale), closeRatio);
  const geometryScale = agreed((motion) => motion.geometryScale, closeRatio);
  const scale = placementScale !== undefined && !closeRatio(placementScale, 1) ? placementScale : unturned ? geometryScale : undefined;
  const changes: ModelChange[] = [];
  if (scale !== undefined && Math.abs(scale - 1) > SCALE_TOLERANCE) {
    changes.push({
      kind: 'resized',
      factor: scale,
      heightBefore: heightOf(before),
      heightAfter: heightOf(after),
      cause: resizeCause(before, after),
    });
  }
  const degrees = rotation ? (rotation.angleTo(new Quaternion()) * 180) / Math.PI : 0;
  if (rotation && degrees > TURN_TOLERANCE_DEGREES) changes.push({ kind: 'turned', degrees: Math.round(degrees), axis: principalAxis(rotation) });
  if (changes.length === 0) {
    const offset = agreed((motion) => motion.geometryOffset, (a, b) => a.distanceTo(b) <= DISTANCE_TOLERANCE_METRES);
    if (offset && offset.length() > DISTANCE_TOLERANCE_METRES && [...geometric, ...skinnedAlike].every((motion) => closeRatio(motion.geometryScale, 1))) {
      changes.push({ kind: 'offPivot', distance: offset.length() });
    }
  }
  return changes;
}

/** The first value, when every value is close to it; undefined when they differ. */
function shared<T>(values: T[], close: (a: T, b: T) => boolean): T | undefined {
  const [first] = values;
  return first !== undefined && values.every((value) => close(value, first)) ? first : undefined;
}

function closeRatio(a: number, b: number): boolean {
  return Math.abs(a / b - 1) <= SCALE_TOLERANCE;
}

interface Motion {
  /** The mesh's placement's uniform scale and rotation in Unity's space (`MeshSummary.placement`), after over before. */
  placementScale: number;
  rotation: Quaternion;
  /** The geometry's size and centre in Unity's space, after over before and after minus before; NaN for a size that
   *  didn't grow alike on every axis (a sculpt), which no ratio matches. */
  geometryScale: number;
  geometryOffset: Vector3;
}

function motionOf({ before: meshBefore, after: meshAfter, nodeBefore: before, nodeAfter: after }: MeshPair): Motion {
  const placement = (elements: number[]) => {
    const rotation = new Quaternion();
    const scale = new Vector3();
    new Matrix4().fromArray(elements).decompose(new Vector3(), rotation, scale);
    return { rotation, size: Math.cbrt(Math.abs(scale.x * scale.y * scale.z)) };
  };
  const b = placement(meshBefore.placement);
  const a = placement(meshAfter.placement);
  const centre = (bounds: Bounds) => new Vector3(...bounds.max).add(new Vector3(...bounds.min)).multiplyScalar(0.5);
  return {
    placementScale: b.size === 0 ? 1 : a.size / b.size,
    rotation: a.rotation.clone().multiply(b.rotation.clone().invert()),
    geometryScale: uniformRatio(before.bounds!, after.bounds!),
    geometryOffset: centre(after.bounds!).sub(centre(before.bounds!)),
  };
}

/** How much bigger the bounds are, when every axis (that has a size) grew alike; NaN when they didn't. */
function uniformRatio(before: Bounds, after: Bounds): number {
  const ratios = [0, 1, 2].flatMap((axis) => {
    const size = before.max[axis]! - before.min[axis]!;
    return size > DISTANCE_TOLERANCE_METRES ? [(after.max[axis]! - after.min[axis]!) / size] : [];
  });
  if (ratios.length === 0) return 1;
  return ratios.every((ratio) => closeRatio(ratio, ratios[0]!)) ? ratios[0]! : Number.NaN;
}

function resizeCause(before: ModelSummary, after: ModelSummary): ResizeCause | null {
  if (before.unitScale !== after.unitScale) return { kind: 'units', before: before.unitScale, after: after.unitScale };
  if (before.importScale !== after.importScale) return { kind: 'importSettings', before: before.importScale, after: after.importScale };
  return null;
}

function heightOf(summary: ModelSummary): number {
  return summary.bounds ? summary.bounds.max[1] - summary.bounds.min[1] : 0;
}

/** X, Y or Z when the rotation is about one of them (within a degree), as an artist names a turn. */
function principalAxis(rotation: Quaternion): 'X' | 'Y' | 'Z' | null {
  const axis = new Vector3(rotation.x, rotation.y, rotation.z).normalize();
  const names = ['X', 'Y', 'Z'] as const;
  const index = [Math.abs(axis.x), Math.abs(axis.y), Math.abs(axis.z)].findIndex((component) => component >= Math.cos(radians(1)));
  return index === -1 ? null : names[index]!;
}

function hierarchyChanges(before: ModelSummary, after: ModelSummary, matching: NodeMatching): ModelChange[] {
  const changes: ModelChange[] = [];
  for (const [b, a] of matching.renamed) changes.push({ kind: 'renamed', node: refOf(after.nodes[a], before.nodes[b]), from: before.nodes[b]!.name });
  for (const [b, a] of matching.moved) changes.push({ kind: 'moved', node: refOf(after.nodes[a], before.nodes[b]), fromPath: before.nodes[b]!.path });
  // A removed or added node is told once, at the top of what went or came: its children go or come with it.
  matching.afterOf.forEach((a, b) => {
    const parent = before.nodes[b]!.parent;
    if (a === -1 && (parent < 0 || matching.afterOf[parent] !== -1)) changes.push({ kind: 'removed', node: refOf(undefined, before.nodes[b]) });
  });
  matching.beforeOf.forEach((b, a) => {
    const parent = after.nodes[a]!.parent;
    if (b === -1 && (parent < 0 || matching.beforeOf[parent] !== -1)) changes.push({ kind: 'added', node: refOf(after.nodes[a], undefined) });
  });
  return changes;
}

/**
 * Nodes whose own transform changed, a pivot moved (the node moved, its geometry stayed) told apart. With a
 * model-wide change told, the nodes above every mesh that carry it aren't listed again.
 */
function transformChanges(before: ModelSummary, after: ModelSummary, matching: NodeMatching, wholeModelChanged: boolean): ModelChange[] {
  const changes: ModelChange[] = [];
  const transformed: NodeRef[] = [];
  const carriers = wholeModelChanged ? ancestorsOfEveryMesh(after) : new Set<number>();
  before.nodes.forEach((nodeBefore, b) => {
    const a = matching.afterOf[b]!;
    if (a <= 0 || carriers.has(a)) return;
    const nodeAfter = after.nodes[a]!;
    if (sameLocalTransform(nodeBefore, nodeAfter)) return;
    const ref = refOf(nodeAfter, nodeBefore);
    // Compensated in its parents (a root scaled ×100 as the units went from metres to centimetres): nothing moved.
    if (sameMatrix(nodeBefore.world, nodeAfter.world)) return;
    if (nodeBefore.mesh !== null && nodeAfter.mesh !== null && sameBounds(nodeBefore.bounds, nodeAfter.bounds)) {
      // A skinned mesh's own node places nothing of it (its bones do): what is drawn stayed, and Unity skins it alike.
      if (before.meshes[nodeBefore.mesh]!.skinned || after.meshes[nodeAfter.mesh]!.skinned) return;
      const origin = (world: number[]) => new Vector3().setFromMatrixPosition(new Matrix4().fromArray(world));
      changes.push({ kind: 'pivotMoved', node: ref, distance: origin(nodeBefore.world).distanceTo(origin(nodeAfter.world)) });
      return;
    }
    transformed.push(ref);
  });
  if (transformed.length > 0) changes.push({ kind: 'transformed', nodes: transformed });
  return changes;
}

function ancestorsOfEveryMesh(summary: ModelSummary): Set<number> {
  const meshNodes = summary.nodes.flatMap((node, i) => (node.mesh === null ? [] : [i]));
  const chains = meshNodes.map((index) => {
    const chain = new Set<number>();
    for (let i = index; i >= 0; i = summary.nodes[i]!.parent) chain.add(i);
    return chain;
  });
  // A mesh is its own carrier when it is the model's only one (a rock turned on its own node).
  return new Set([...(chains[0] ?? [])].filter((node) => chains.every((chain) => chain.has(node))));
}

function sameLocalTransform(a: SummaryNode, b: SummaryNode): boolean {
  const close = (x: number[], y: number[]) => x.every((value, i) => Math.abs(value - y[i]!) <= 1e-4 * Math.max(1, Math.abs(value)));
  return close(a.position, b.position) && close(a.rotation, b.rotation) && close(a.scale, b.scale);
}

function sameMatrix(a: number[], b: number[]): boolean {
  return a.every((value, i) => Math.abs(value - b[i]!) <= 1e-6 * Math.max(1, Math.abs(value)));
}

function sameBounds(a: SummaryNode['bounds'], b: SummaryNode['bounds']): boolean {
  if (!a || !b) return a === b;
  return [...a.min, ...a.max].every((value, i) => Math.abs(value - [...b.min, ...b.max][i]!) <= DISTANCE_TOLERANCE_METRES);
}

/**
 * Material slots across the model, as Unity remaps materials onto it by slot name: a name that went and another
 * that came in the same place of the same mesh is a rename.
 */
function slotChanges(pairs: MeshPair[]): ModelChange[] {
  const namesBefore = new Set(pairs.flatMap((pair) => pair.before.slots));
  const namesAfter = new Set(pairs.flatMap((pair) => pair.after.slots));
  const renames = new Map<string, string>();
  for (const { before, after } of pairs) {
    before.slots.forEach((slot, i) => {
      const next = after.slots[i];
      if (next !== undefined && next !== slot && !namesAfter.has(slot) && !namesBefore.has(next) && !renames.has(slot)) renames.set(slot, next);
    });
  }
  const renamedTo = new Set(renames.values());
  const changes: ModelChange[] = [...renames].map(([from, to]): ModelChange => ({ kind: 'slotRenamed', from, to }));
  for (const slot of namesBefore) if (!namesAfter.has(slot) && !renames.has(slot)) changes.push({ kind: 'slotRemoved', slot });
  for (const slot of namesAfter) if (!namesBefore.has(slot) && !renamedTo.has(slot)) changes.push({ kind: 'slotAdded', slot });
  for (const { before, after, ref } of pairs) {
    const renamed = before.slots.map((slot) => renames.get(slot) ?? slot);
    if (!sameSlotsBut(renamed, after.slots, changes)) changes.push({ kind: 'meshSlots', node: ref, before: before.slots, after: after.slots });
  }
  return changes;
}

/** A mesh whose slots differ only by a slot added or removed model-wide, already told. */
function sameSlotsBut(before: string[], after: string[], told: ModelChange[]): boolean {
  const added = new Set(told.flatMap((change) => (change.kind === 'slotAdded' ? [change.slot] : [])));
  const removed = new Set(told.flatMap((change) => (change.kind === 'slotRemoved' ? [change.slot] : [])));
  return before.filter((slot) => !removed.has(slot)).join('\n') === after.filter((slot) => !added.has(slot)).join('\n');
}

/**
 * What changed in one mesh's data. A mesh rebuilt (another triangle count) changed everything; only that is told.
 * `verticesMovedAlike`: its vertices all moved as a change told already did (a pivot, a resize): no change of shape.
 */
function meshChanges({ before, after, ref }: MeshPair, verticesMovedAlike: boolean): ModelChange[] {
  const changes: ModelChange[] = [];
  const old = before.fingerprints;
  const next = after.fingerprints;
  if (before.triangles !== after.triangles) {
    changes.push({ kind: 'triangles', node: ref, before: before.triangles, after: after.triangles });
  } else {
    // A shape changed when the mesh's vertices did, and where they end up in the scene did too: vertices shifted to
    // make up for a node moved (a pivot, a new parent) leave the mesh as it looked.
    const moved = old.positions !== next.positions && old.placedPositions !== next.placedPositions;
    if (moved && !verticesMovedAlike) changes.push({ kind: 'shape', node: ref });
    else {
      // Its vertices where they were, joined into other triangles: told as that, as a shape change it would read as
      // a sculpt, while a flat face split another way looks the same.
      if (old.index !== next.index) changes.push({ kind: old.corners === next.corners ? 'facesFlipped' : 'triangulation', node: ref });
      if (old.normals !== next.normals) changes.push({ kind: 'normals', node: ref });
    }
    if (before.hasUv && after.hasUv && old.uv !== next.uv) changes.push({ kind: 'uvs', node: ref });
    if (before.hasColors && after.hasColors && old.colors !== next.colors) changes.push({ kind: 'vertexColorsChanged', node: ref });
    const offsetsBefore = new Map(before.blendShapes.map((name, i) => [name, old.blendShapes[i]]));
    const resculpted = after.blendShapes.filter((name, i) => offsetsBefore.has(name) && offsetsBefore.get(name) !== next.blendShapes[i]);
    if (resculpted.length > 0) changes.push({ kind: 'blendShapesChanged', node: ref, names: resculpted });
    if (before.bones.length > 0 && after.bones.length > 0 && (old.skin !== next.skin || before.bones.join('\n') !== after.bones.join('\n'))) changes.push({ kind: 'skinning', node: ref });
  }
  if (before.hasLightmapUv !== after.hasLightmapUv) changes.push({ kind: 'lightmapUvs', node: ref, now: after.hasLightmapUv });
  if (before.hasColors !== after.hasColors) changes.push({ kind: 'vertexColors', node: ref, now: after.hasColors });
  changes.push(...blendShapeChanges(before.blendShapes, after.blendShapes, ref));
  return changes;
}

function blendShapeChanges(before: string[], after: string[], node: NodeRef): ModelChange[] {
  const removed = before.filter((name) => !after.includes(name));
  const added = after.filter((name) => !before.includes(name));
  if (removed.length === 1 && added.length === 1 && before.length === after.length) return [{ kind: 'blendShapeRenamed', node, from: removed[0]!, to: added[0]! }];
  return [...removed.map((name): ModelChange => ({ kind: 'blendShapeRemoved', node, name })), ...added.map((name): ModelChange => ({ kind: 'blendShapeAdded', node, name }))];
}

/**
 * Takes by name, as Unity's clips name the take they're cut from: one gone and one come of the same length is a rename.
 * A take of the same length whose keys changed is told with the nodes it moves differently: the viewer plays it, but
 * only once picked, so the panel says where to look.
 */
function clipChanges(before: ModelSummary, after: ModelSummary, matching: NodeMatching): ModelChange[] {
  const lengths = new Map(after.clips.map((clip) => [clip.name, clip.duration]));
  const names = new Set(before.clips.map((clip) => clip.name));
  const removed = before.clips.filter((clip) => !lengths.has(clip.name));
  const added = after.clips.filter((clip) => !names.has(clip.name));
  const changes: ModelChange[] = [];
  if (removed.length === 1 && added.length === 1 && Math.abs(removed[0]!.duration - added[0]!.duration) <= DURATION_TOLERANCE_SECONDS) {
    changes.push({ kind: 'clipRenamed', from: removed[0]!.name, to: added[0]!.name });
  } else {
    changes.push(...removed.map((clip): ModelChange => ({ kind: 'clipRemoved', name: clip.name })), ...added.map((clip): ModelChange => ({ kind: 'clipAdded', name: clip.name })));
  }
  for (const clip of before.clips) {
    const length = lengths.get(clip.name);
    if (length !== undefined && Math.abs(length - clip.duration) > DURATION_TOLERANCE_SECONDS) changes.push({ kind: 'clipLength', name: clip.name, before: clip.duration, after: length });
  }
  const clipsAfter = new Map(after.clips.map((clip) => [clip.name, clip]));
  for (const clip of before.clips) {
    const next = clipsAfter.get(clip.name);
    if (!next || Math.abs(next.duration - clip.duration) > DURATION_TOLERANCE_SECONDS) continue;
    const nodes = rekeyedNodes(clip.tracks, next.tracks, before, after, matching);
    if (nodes) changes.push({ kind: 'clipKeys', name: clip.name, nodes });
  }
  return changes;
}

/**
 * The nodes whose tracks differ between the versions of a take (keyed differently, or only on one side), in the
 * version after's order, each once; null when every track is the same.
 */
function rekeyedNodes(before: TakeTrack[], after: TakeTrack[], summaryBefore: ModelSummary, summaryAfter: ModelSummary, matching: NodeMatching): NodeRef[] | null {
  const keysOf = (tracks: TakeTrack[]) => new Map(tracks.map((track) => [track.name, track]));
  const [was, now] = [keysOf(before), keysOf(after)];
  const changed = [...new Set([...was.keys(), ...now.keys()])].filter((name) => was.get(name)?.keys !== now.get(name)?.keys);
  if (changed.length === 0) return null;
  const indexOf = (summary: ModelSummary) => {
    const indices = new Map(summary.nodes.map((node, i) => [node.key, i]));
    return (track: TakeTrack | undefined): number => (track?.node == null ? -1 : (indices.get(track.node) ?? -1));
  };
  const [indexBefore, indexAfter] = [indexOf(summaryBefore), indexOf(summaryAfter)];
  // Each node as an index after, or (gone since, or no longer keyed) before.
  const sides = new Map<string, { after: number; before: number }>();
  for (const name of changed) {
    const keyedAfter = indexAfter(now.get(name));
    const a = keyedAfter !== -1 ? keyedAfter : (matching.afterOf[indexBefore(was.get(name))] ?? -1);
    const b = a === -1 ? indexBefore(was.get(name)) : matching.beforeOf[a]!;
    if (a !== -1 || b !== -1) sides.set(`${a}:${b}`, { after: a, before: b });
  }
  return [...sides.values()]
    .sort((x, y) => (x.after === -1 ? Infinity : x.after) - (y.after === -1 ? Infinity : y.after) || x.before - y.before)
    .map(({ after, before }) => refOf(summaryAfter.nodes[after], summaryBefore.nodes[before]));
}

/**
 * The textures the file's materials name (FBX, OBJ, a glTF's files beside it) and the images a glTF holds, by name:
 * one gone, one come, and one held in the file whose bytes changed under its name (a repaint, which no file of its own
 * would show). Each with the meshes that show it, so the row frames where to look.
 */
function textureChanges(before: ModelSummary, after: ModelSummary, matching: NodeMatching): ModelChange[] {
  const held = (summary: ModelSummary) => new Map(summary.images.flatMap((image) => (image.bytes === null ? [] : [[image.name, image.bytes] as const])));
  const [heldBefore, heldAfter] = [held(before), held(after)];
  const names = (summary: ModelSummary, images: Map<string, string>) => [...new Set([...summary.textures, ...images.keys()])];
  const [namesBefore, namesAfter] = [names(before, heldBefore), names(after, heldAfter)];
  const added = namesAfter.filter((name) => !namesBefore.includes(name));
  const removed = namesBefore.filter((name) => !namesAfter.includes(name));
  const repainted = [...heldAfter].flatMap(([name, bytes]) => (heldBefore.has(name) && heldBefore.get(name) !== bytes ? [name] : []));
  const changes: ModelChange[] = [];
  if (added.length + removed.length > 0) changes.push({ kind: 'textures', added, removed, nodes: meshesShowing(before, after, matching, added, removed) });
  if (repainted.length > 0) changes.push({ kind: 'embeddedTextures', names: repainted, nodes: meshesShowing(before, after, matching, repainted, repainted) });
  return changes;
}

/** The meshes whose materials map one of the textures: `now` in the version after, `was` (gone since) before. */
function meshesShowing(before: ModelSummary, after: ModelSummary, matching: NodeMatching, now: string[], was: string[]): NodeRef[] {
  const showing = (summary: ModelSummary, textures: string[]) =>
    summary.nodes.flatMap((node, i) => (node.mesh !== null && summary.meshes[node.mesh]!.textures.some((name) => textures.includes(name)) ? [i] : []));
  const nodesAfter = new Set(showing(after, now));
  for (const b of showing(before, was)) if (matching.afterOf[b] !== -1) nodesAfter.add(matching.afterOf[b]!);
  const refs = [...nodesAfter].sort((x, y) => x - y).map((a) => refOf(after.nodes[a], before.nodes[matching.beforeOf[a]!]));
  const gone = showing(before, was).filter((b) => matching.afterOf[b] === -1).map((b) => refOf(undefined, before.nodes[b]));
  return [...refs, ...gone];
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
