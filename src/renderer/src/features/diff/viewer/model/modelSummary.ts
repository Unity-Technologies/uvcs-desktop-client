// What Unity would show of one version of a model: its GameObjects by path, each mesh's triangles and vertices as the
// Inspector counts them, material slots, blendshapes, bones, takes, and where everything sits in Unity's space
// (metres, Y up, X mirrored as Unity's importer turns right-handed files left-handed). Computed once per version in
// the model worker; `modelChanges` compares two of them, the info strip and the "What changed" panel read them.

import { Box3, Matrix4, Vector3 } from 'three';
import type { ModelMesh, ModelNodeKind, ParsedModel } from './parsedModel';
import { worldMatricesOf } from './modelSpaces';
import { countUniqueVertices, fingerprintOf, NORMAL_WELD_STEP } from './uniqueVertices';

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SummaryNode {
  /** Unique among the model's nodes: the path, and ` #2`, ` #3`… for later siblings of the same name. */
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
  upAxis: ParsedModel['upAxis'];
  exportedFrom: string | null;
  totals: { triangles: number; vertices: number; meshes: number; materials: number; bones: number; blendShapes: number };
  /** The whole model in Unity's space; null when it draws nothing. */
  bounds: Bounds | null;
}

const PLACED_STEP_METRES = 1e-5;

export function modelSummary(model: ParsedModel): ModelSummary {
  const keys = nodeKeys(model);
  const world = worldMatricesOf(model);
  const meshOfNode = new Map(model.meshes.map((mesh, i) => [mesh.node, i]));
  const meshes = model.meshes.map((mesh) => meshSummary(mesh, keys, world[mesh.node]!));
  const ownBounds = model.nodes.map((_, i) => {
    const mesh = meshOfNode.get(i);
    return mesh === undefined ? null : transformedBounds(model.meshes[mesh]!.attributes.position, world[i]!);
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

function meshSummary(mesh: ModelMesh, keys: string[], world: Matrix4): MeshSummary {
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
    hasNormals: attributes.normal !== null,
    hasUv: attributes.uv !== null,
    hasLightmapUv: attributes.uv1 !== null,
    hasColors: attributes.color !== null,
    localBounds: transformedBounds(attributes.position, new Matrix4())!,
    fingerprints: {
      positions: fingerprintOf(attributes.position),
      placedPositions: fingerprintOf(placedPositions(attributes.position, world)),
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

/** Where the mesh's vertices end up in Unity's space, in steps of 10 µm, so float noise from the matrices weighs nothing. */
function placedPositions(positions: Float32Array, world: Matrix4): Int32Array {
  const placed = new Int32Array(positions.length);
  const point = new Vector3();
  for (let i = 0; i < positions.length; i += 3) {
    point.set(positions[i]!, positions[i + 1]!, positions[i + 2]!).applyMatrix4(world);
    placed[i] = Math.round(point.x / PLACED_STEP_METRES);
    placed[i + 1] = Math.round(point.y / PLACED_STEP_METRES);
    placed[i + 2] = Math.round(point.z / PLACED_STEP_METRES);
  }
  return placed;
}

/** Each node's path, made unique with ` #2`, ` #3`… for siblings sharing a name (Unity allows them; paths can't tell them apart). */
function nodeKeys(model: ParsedModel): string[] {
  const keys: string[] = [];
  const seen = new Map<string, number>();
  model.nodes.forEach((_, i) => {
    const path = pathOf(model, i);
    const occurrence = (seen.get(path) ?? 0) + 1;
    seen.set(path, occurrence);
    keys.push(occurrence === 1 ? path : `${path} #${occurrence}`);
  });
  return keys;
}

function pathOf(model: ParsedModel, index: number): string {
  const names: string[] = [];
  for (let i = index; i > 0 && model.nodes[i]!.parent >= 0; i = model.nodes[i]!.parent) names.unshift(model.nodes[i]!.name);
  return names.join('/');
}

function transformedBounds(positions: Float32Array, matrix: Matrix4): Bounds | null {
  if (positions.length === 0) return null;
  const box = new Box3();
  const point = new Vector3();
  const identity = matrix.equals(new Matrix4());
  for (let i = 0; i < positions.length; i += 3) {
    point.set(positions[i]!, positions[i + 1]!, positions[i + 2]!);
    if (!identity) point.applyMatrix4(matrix);
    box.expandByPoint(point);
  }
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
