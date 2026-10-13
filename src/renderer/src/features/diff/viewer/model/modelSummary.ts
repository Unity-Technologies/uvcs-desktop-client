// What Unity would show of one version of a model: its GameObjects by path, each mesh's triangles and vertices as the
// Inspector counts them, material slots, blendshapes, bones, takes, and where everything sits in Unity's space
// (metres, Y up, X mirrored as Unity's importer turns right-handed files left-handed). Computed once per version in
// the model worker; `modelChanges` compares two of them, the info strip and the "What changed" panel read them.

import { Box3, Vector3 } from 'three';
import type { ModelMesh, ModelNodeKind, ParsedModel } from './parsedModel';
import { isSkinned, placedPositionsOf, restingPlacementOf } from './meshPlacement';
import { unitySpaceOf, worldMatricesOf } from './modelSpaces';
import { countUniqueVertices, fingerprintOf, NORMAL_WELD_STEP } from './uniqueVertices';

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SummaryNode {
  /** Unique among the model's nodes: the path, with ` #2`, ` #3`… after later siblings of the same name (`nodeKeys`). */
  key: string;
  /** Names from the root's child down (`Armature/Hips/Spine`), as Unity's `transform.Find` and animations take them; '' for the root. */
  path: string;
  name: string;
  parent: number;
  kind: ModelNodeKind;
  /** The local transform, in the file's units. */
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  /** From the node's space to Unity's (column-major 4×4): where it sits, turned and scaled, in the scene. */
  world: number[];
  /** What the node and everything under it draws, in Unity's space; null for nothing. */
  bounds: Bounds | null;
  /** Its mesh's index in `meshes`, if it has one. */
  mesh: number | null;
}

export interface MeshSummary {
  node: number;
  triangles: number;
  /** About as Unity counts them: corners welded where every attribute matches (`countUniqueVertices`). */
  vertices: number;
  /** The material slots its triangles use, in slot order: Unity's submeshes. A slot no triangle uses, Unity drops. */
  slots: string[];
  blendShapes: string[];
  /** Bones the mesh is skinned to, by node key; empty for a mesh that isn't skinned. */
  bones: string[];
  /** Placed by its bones (`placedPositionsOf`), not by its node: its node's own transform says nothing of where it is. */
  skinned: boolean;
  /** Where it is placed before any bone moves it, in Unity's space (`restingPlacementOf`), column-major: a turn or a
   *  scale of the whole model is read from it. */
  placement: number[];
  hasNormals: boolean;
  hasUv: boolean;
  /** UV1: lightmap UVs the artist made, which Unity's "Generate Lightmap UVs" would otherwise have to. */
  hasLightmapUv: boolean;
  hasColors: boolean;
  /** The geometry in the node's own space and the file's units, to tell a moved pivot from a moved node. */
  localBounds: Bounds;
  /** Fingerprints of each attribute's exact values: equal when the data Unity imports is the same. */
  fingerprints: {
    positions: string;
    /** The positions where they end up in Unity's space, to 10 µm: equal when the mesh looks the same in place. */
    placedPositions: string;
    normals: string;
    uv: string;
    uv1: string;
    colors: string;
    index: string;
    skin: string;
    blendShapes: string;
  };
}

export interface ModelSummary {
  nodes: SummaryNode[];
  meshes: MeshSummary[];
  clips: { name: string; duration: number }[];
  textures: string[];
  unitScale: number;
  /** What the import settings scale the model by (`ParsedModel.importScale`). */
  importScale: number;
  /** The takes' frames per second (`ParsedModel.frameRate`). */
  frameRate: number | null;
  upAxis: ParsedModel['upAxis'];
  exportedFrom: string | null;
  totals: { triangles: number; vertices: number; meshes: number; materials: number; bones: number; blendShapes: number };
  /** The whole model in Unity's space; null when it draws nothing. */
  bounds: Bounds | null;
}

const PLACED_STEP_METRES = 1e-5;

export function modelSummary(model: ParsedModel): ModelSummary {
  const keys = nodeKeys(model);
  const space = unitySpaceOf(model);
  const world = worldMatricesOf(model, space);
  const meshOfNode = new Map(model.meshes.map((mesh, i) => [mesh.node, i]));
  const ownBounds: (Bounds | null)[] = model.nodes.map(() => null);
  const meshes = model.meshes.map((mesh) => {
    // Where its vertices sit in Unity's space, as drawn at rest (skinned ones where their bones hold them): read
    // here and let go, so a big model never holds every mesh's placement at once.
    const placed = placedPositionsOf(mesh, { space, world }, new Float64Array(mesh.attributes.position.length));
    ownBounds[mesh.node] = boundsOf(placed);
    return meshSummary(mesh, keys, placed, restingPlacementOf(mesh, { space, world }).elements);
  });
  const subtreeBounds = [...ownBounds];
  // Children come after their parents: walking back, each node's bounds are complete before its parent takes them.
  for (let i = model.nodes.length - 1; i > 0; i--) {
    const parent = model.nodes[i]!.parent;
    if (parent >= 0) subtreeBounds[parent] = union(subtreeBounds[parent]!, subtreeBounds[i]!);
  }
  const nodes: SummaryNode[] = model.nodes.map((node, i) => ({
    key: keys[i]!,
    path: pathOf(model, i),
    name: node.name,
    parent: node.parent,
    kind: node.kind,
    position: node.position,
    rotation: node.rotation,
    scale: node.scale,
    world: world[i]!.elements.slice(),
    bounds: subtreeBounds[i]!,
    mesh: meshOfNode.get(i) ?? null,
  }));
  return {
    nodes,
    meshes,
    clips: model.clips.map(({ name, duration }) => ({ name, duration })),
    textures: model.textures,
    unitScale: model.unitScale,
    importScale: model.importScale,
    frameRate: model.frameRate,
    upAxis: model.upAxis,
    exportedFrom: model.exportedFrom,
    totals: {
      triangles: sum(meshes, (mesh) => mesh.triangles),
      vertices: sum(meshes, (mesh) => mesh.vertices),
      meshes: meshes.length,
      materials: new Set(meshes.flatMap((mesh) => mesh.slots)).size,
      bones: nodes.filter((node) => node.kind === 'bone').length,
      blendShapes: sum(meshes, (mesh) => mesh.blendShapes.length),
    },
    bounds: nodes[0]?.bounds ?? null,
  };
}

function meshSummary(mesh: ModelMesh, keys: string[], placed: Float64Array, placement: number[]): MeshSummary {
  const { attributes } = mesh;
  const vertexCount = attributes.position.length / 3;
  const drawn = [
    { array: attributes.position, size: 3, step: 0 },
    { array: attributes.normal, size: 3, step: NORMAL_WELD_STEP },
    { array: attributes.uv, size: 2, step: 0 },
    { array: attributes.uv1, size: 2, step: 0 },
    { array: attributes.color, size: attributes.colorSize, step: 0 },
  ].filter((attribute): attribute is { array: Float32Array; size: number; step: number } => attribute.array !== null);
  return {
    node: mesh.node,
    triangles: Math.floor((mesh.index?.length ?? vertexCount) / 3),
    vertices: countUniqueVertices({ arrays: drawn.map((a) => a.array), sizes: drawn.map((a) => a.size), steps: drawn.map((a) => a.step), count: vertexCount }),
    slots: mesh.slots.filter((_, slot) => mesh.groups.some((group) => group.slot === slot && group.count > 0)),
    blendShapes: mesh.blendShapes.map((shape) => shape.name),
    bones: mesh.skin ? mesh.skin.bones.map((bone) => keys[bone] ?? '') : [],
    skinned: isSkinned(mesh),
    placement,
    hasNormals: attributes.normal !== null,
    hasUv: attributes.uv !== null,
    hasLightmapUv: attributes.uv1 !== null,
    hasColors: attributes.color !== null,
    localBounds: boundsOf(attributes.position)!,
    fingerprints: {
      positions: fingerprintOf(attributes.position),
      placedPositions: fingerprintOf(inPlacedSteps(placed)),
      normals: fingerprintOf(attributes.normal),
      uv: fingerprintOf(attributes.uv),
      uv1: fingerprintOf(attributes.uv1),
      colors: fingerprintOf(attributes.color),
      index: fingerprintOf(mesh.index),
      skin: `${fingerprintOf(attributes.skinIndex)}|${fingerprintOf(attributes.skinWeight)}`,
      blendShapes: mesh.blendShapes.map((shape) => fingerprintOf(shape.deltas)).join('|'),
    },
  };
}

/** Placed positions in steps of 10 µm, so float noise from the matrices weighs nothing. */
function inPlacedSteps(placed: Float64Array): Int32Array {
  return Int32Array.from(placed, (value) => Math.round(value / PLACED_STEP_METRES));
}

/**
 * Each node's key: its parent's key and its name, with ` #2`, ` #3`… for later siblings of the same name (Unity
 * allows them; paths can't tell them apart), so the children of each keep under it (`Wheel #2/Bolt`).
 */
function nodeKeys(model: ParsedModel): string[] {
  const keys: string[] = [];
  const seen = new Map<string, number>();
  model.nodes.forEach((node) => {
    if (node.parent < 0) return keys.push('');
    const parentKey = keys[node.parent]!;
    const plain = parentKey === '' ? node.name : `${parentKey}/${node.name}`;
    const occurrence = (seen.get(plain) ?? 0) + 1;
    seen.set(plain, occurrence);
    keys.push(occurrence === 1 ? plain : `${plain} #${occurrence}`);
  });
  return keys;
}

function pathOf(model: ParsedModel, index: number): string {
  const names: string[] = [];
  for (let i = index; i > 0 && model.nodes[i]!.parent >= 0; i = model.nodes[i]!.parent) names.unshift(model.nodes[i]!.name);
  return names.join('/');
}

function boundsOf(positions: Float32Array | Float64Array): Bounds | null {
  if (positions.length === 0) return null;
  const box = new Box3();
  const point = new Vector3();
  for (let i = 0; i < positions.length; i += 3) box.expandByPoint(point.set(positions[i]!, positions[i + 1]!, positions[i + 2]!));
  return { min: box.min.toArray(), max: box.max.toArray() };
}

function union(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
  };
}

function sum<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}
