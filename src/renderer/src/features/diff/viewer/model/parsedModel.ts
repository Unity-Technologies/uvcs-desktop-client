// A 3D model as the diff knows it: plain data, the same whatever format it was read from (FBX, OBJ, glTF), in typed
// arrays that cross from the model worker without a copy. Everything the viewer draws (`buildModelScene`) and tells
// (`modelSummary`, `modelChanges`) reads this, never a loader's own objects.

import type { ModelFormat } from '@shared/domain/content';

export type Vector3Tuple = [number, number, number];
export type QuaternionTuple = [number, number, number, number];

/** What a node of the hierarchy is: in Unity, each one is a GameObject under the model's prefab. */
export type ModelNodeKind = 'group' | 'mesh' | 'skinnedMesh' | 'bone' | 'light' | 'camera';

export interface ModelNode {
  /** The name Unity gives its GameObject, and the last part of its path (`Armature/Hips/Spine`). */
  name: string;
  /** The parent's index in `nodes`, before it; -1 for the model's root. */
  parent: number;
  kind: ModelNodeKind;
  /** Local transform, in the file's units. */
  position: Vector3Tuple;
  rotation: QuaternionTuple;
  scale: Vector3Tuple;
}

/** The vertex attributes the diff reads, as floats whatever the file stored (glTF quantizes some). */
export interface MeshAttributes {
  position: Float32Array;
  normal: Float32Array | null;
  /** UV0: where textures map. */
  uv: Float32Array | null;
  /** UV1: the lightmap UVs Unity bakes into, when the artist made them. */
  uv1: Float32Array | null;
  color: Float32Array | null;
  /** Floats per color: 3 (RGB) or 4 (RGBA). */
  colorSize: 3 | 4;
  /** Four bone indices (into `MeshSkin.bones`) and weights per vertex, for skinned meshes. */
  skinIndex: Uint16Array | null;
  skinWeight: Float32Array | null;
}

/** A range of the mesh drawn with one material slot: triangles `start / 3` to `(start + count) / 3`. */
export interface MeshGroup {
  start: number;
  count: number;
  slot: number;
}

export interface MeshSkin {
  /** The bones that deform the mesh, as indices in `nodes`. */
  bones: number[];
  /** Each bone's inverse bind matrix, 16 floats apiece. */
  boneInverses: Float32Array;
}

/** A blendshape (morph target): the offset of every vertex from the base shape. */
export interface BlendShape {
  name: string;
  deltas: Float32Array;
}

export interface ModelMesh {
  /** The node the mesh hangs on, as an index in `nodes`. */
  node: number;
  attributes: MeshAttributes;
  /** Indexed geometry's indices; null when every three vertices make a triangle. */
  index: Uint32Array | null;
  /** The material slots' names: Unity remaps materials onto a model by these. */
  slots: string[];
  groups: MeshGroup[];
  skin: MeshSkin | null;
  blendShapes: BlendShape[];
}

/** An animation take, which Unity imports as an animation clip. `tracks` is three's clip JSON, for playback. */
export interface ModelClip {
  name: string;
  /** In seconds. */
  duration: number;
  tracks: unknown;
}

export interface ParsedModel {
  format: ModelFormat;
  /** Parents before their children; `nodes[0]` is the root (the model itself). */
  nodes: ModelNode[];
  meshes: ModelMesh[];
  clips: ModelClip[];
  /** The texture files the materials name, sorted; never read. */
  textures: string[];
  /** Metres per file unit, as Unity imports it ("Convert Units"): an FBX in centimetres is 0.01. */
  unitScale: number;
  /** The file's up axis. Unity stands a file on Y whatever its axes: `axisConversion`, above the root, does it. */
  upAxis: 'x' | 'y' | 'z';
  /** From the file's axes onto Unity's (`fbxAxisConversion`), as a column-major 4×4; the identity for a Y-up file. */
  axisConversion: number[];
  /** The app that exported the file, when it says (`Blender 4.2.1`). */
  exportedFrom: string | null;
}

/** The buffers to transfer (not copy) when a model crosses to another thread. */
export function transferablesOf(model: ParsedModel): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const add = (array: ArrayBufferView | null): void => {
    if (array && array.buffer instanceof ArrayBuffer) buffers.add(array.buffer);
  };
  for (const mesh of model.meshes) {
    for (const array of Object.values(mesh.attributes)) if (typeof array === 'object') add(array);
    add(mesh.index);
    if (mesh.skin) add(mesh.skin.boneInverses);
    for (const shape of mesh.blendShapes) add(shape.deltas);
  }
  return [...buffers];
}
