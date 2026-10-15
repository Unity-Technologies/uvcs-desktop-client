// What Unity would show of one version of a model: its GameObjects by path, each mesh's triangles and vertices as the
// Inspector counts them, material slots, blendshapes, bones, takes, and where everything sits in Unity's space
// (metres, Y up, X mirrored as Unity's importer turns right-handed files left-handed). Computed once per version in
// the model worker; `modelChanges` compares two of them, the info strip and the "What changed" panel read them.

import { Box3, Vector3 } from 'three';
import type { FileImage, FileTexture, ModelMesh, ModelNodeKind, ParsedModel } from './parsedModel';
import { fileNameOf } from './noTextureLoading';
import { isSkinned, placedPositionsOf, restingPlacementOf } from './meshPlacement';
import { unitySpaceOf, worldMatricesOf } from './modelSpaces';
import { takeTracksOf, type TakeTrack } from './takeTracks';
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
  /** The textures its slots' materials map (`texturesOfMesh`), by the names `ModelSummary.textures` and `images` give them. */
  textures: string[];
  /** Bones the mesh is skinned to, by node key; empty for a mesh that isn't skinned. */
  bones: string[];
  /** Placed by its bones (`placedPositionsOf`), not by its node: its node's own transform says nothing of where it is. */
  skinned: boolean;
  /** Where it is placed at rest, in Unity's space (`restingPlacementOf`: skinned, where its top-most joint carries it),
   *  column-major: a turn or a scale of the whole model is read from it. */
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
    /** The triangles as a set, each turning its way (`trianglesFingerprint`): equal when only their order in the file changed. */
    index: string;
    /** The triangles as a set of corners, whichever way each turns: equal when only some faces flipped. */
    corners: string;
    skin: string;
    /** Each blendshape's offsets, in `blendShapes`' order. */
    blendShapes: string[];
  };
}

export interface ModelSummary {
  nodes: SummaryNode[];
  meshes: MeshSummary[];
  /** The takes, and what each keys (`takeTracksOf`). */
  clips: { name: string; duration: number; tracks: TakeTrack[] }[];
  /** The texture files the materials name (`ParsedModel.textures`). */
  textures: string[];
  /** A glTF's images (`ParsedModel.images`). */
  images: FileImage[];
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
    return meshSummary(mesh, keys, placed, restingPlacementOf(mesh, { space, world }).elements, texturesOfMesh(mesh, model));
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
    clips: model.clips.map((clip) => ({ name: clip.name, duration: clip.duration, tracks: takeTracksOf(clip, model, keys) })),
    textures: model.textures,
    images: model.images,
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

function meshSummary(mesh: ModelMesh, keys: string[], placed: Float64Array, placement: number[], textures: string[]): MeshSummary {
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
    textures,
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
      index: trianglesFingerprint(mesh.index, 'winding'),
      corners: trianglesFingerprint(mesh.index, 'corners'),
      skin: `${fingerprintOf(attributes.skinIndex)}|${fingerprintOf(attributes.skinWeight)}`,
      blendShapes: mesh.blendShapes.map((shape) => fingerprintOf(shape.deltas)),
    },
  };
}

/** The textures the materials of the mesh's slots map (base and normal), each once: what a texture changed shows on. */
function texturesOfMesh(mesh: ModelMesh, model: Pick<ParsedModel, 'materials' | 'images'>): string[] {
  const names = mesh.slotMaterials.flatMap((material) => {
    const own = model.materials[material];
    return own ? [own.baseMap, own.normalMap].flatMap((use) => (use ? [textureName(use.texture, model.images)] : [])) : [];
  });
  return [...new Set(names)];
}

function textureName(texture: FileTexture, images: FileImage[]): string {
  switch (texture.kind) {
    case 'named':
      return texture.name;
    case 'beside':
      return fileNameOf(texture.path);
    case 'gltfImage':
      return images[texture.image]?.name ?? `image ${texture.image + 1}`;
  }
}

/**
 * The triangles by their vertices, whatever order the file lists them in and whichever corner each starts from: a
 * re-export writes them in another order, and Unity's import reorders them for the GPU anyway, so an order alone
 * changed nothing. By `winding`, each keeps the way it turns (its front); by `corners`, only which vertices it joins.
 * '' for a mesh without an index.
 */
function trianglesFingerprint(index: Uint32Array | null, by: 'winding' | 'corners'): string {
  if (!index) return '';
  const triangles: [number, number, number][] = [];
  for (let i = 0; i + 2 < index.length; i += 3) {
    const [a, b, c] = [index[i]!, index[i + 1]!, index[i + 2]!];
    // Started from its lowest vertex, turning the same way: (5, 1, 3) is (1, 3, 5); by corners, (1, 5, 3) is too.
    const started: [number, number, number] = a <= b && a <= c ? [a, b, c] : b <= c ? [b, c, a] : [c, a, b];
    triangles.push(by === 'winding' ? started : [started[0], Math.min(started[1], started[2]), Math.max(started[1], started[2])]);
  }
  triangles.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  return fingerprintOf(Uint32Array.from(triangles.flat()));
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
