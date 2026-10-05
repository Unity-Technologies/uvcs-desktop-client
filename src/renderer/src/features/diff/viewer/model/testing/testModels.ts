// `ParsedModel`s built in tests: a hierarchy by names, each mesh a box of its own size and slots, so a test reads as
// the model an artist exported ("a crate with a lid") and states only what it is about.

import { AnimationClip, Euler, Quaternion } from 'three';
import { fbxAxisConversion, Y_UP_AXES } from '../fbxAxes';
import type { ModelClip, ModelMesh, ModelNode, ModelNodeKind, ParsedModel } from '../parsedModel';

export interface TestNode {
  name: string;
  /** The parent's name; the root's child when absent. */
  parent?: string;
  kind?: ModelNodeKind;
  position?: [number, number, number];
  /** Euler XYZ in degrees. */
  rotation?: [number, number, number];
  scale?: [number, number, number];
  mesh?: TestMesh;
}

export interface TestMesh {
  size?: [number, number, number];
  center?: [number, number, number];
  /** One slot per two faces of the box, cycling: one slot draws the whole box. */
  slots?: string[];
  normals?: boolean;
  uv?: boolean;
  uv1?: boolean;
  colors?: boolean;
  blendShapes?: string[];
  /** Bone names the mesh is skinned to. */
  bones?: string[];
}

export interface TestModel {
  /** The root's name: '' as a file with several top-level nodes gets. */
  root?: string;
  nodes: TestNode[];
  unitScale?: number;
  upAxis?: 'y' | 'z';
  clips?: { name: string; duration: number }[];
  textures?: string[];
  exportedFrom?: string | null;
}

/** 3ds Max's: Z up, -Y front. */
const MAX_AXES = { upAxis: 2, upAxisSign: 1, frontAxis: 1, frontAxisSign: -1, coordAxis: 0, coordAxisSign: 1 };

export function testModel(spec: TestModel): ParsedModel {
  const nodes: ModelNode[] = [{ name: spec.root ?? '', parent: -1, kind: 'group', position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }];
  const index = new Map<string, number>();
  for (const node of spec.nodes) {
    index.set(node.name, nodes.length);
    const [x, y, z] = (node.rotation ?? [0, 0, 0]).map((degrees) => (degrees * Math.PI) / 180) as [number, number, number];
    const quaternion = new Quaternion().setFromEuler(new Euler(x, y, z, 'XYZ'));
    nodes.push({
      name: node.name,
      parent: node.parent === undefined ? 0 : index.get(node.parent)!,
      kind: node.kind ?? (node.mesh ? 'mesh' : 'group'),
      position: node.position ?? [0, 0, 0],
      rotation: quaternion.toArray() as ModelNode['rotation'],
      scale: node.scale ?? [1, 1, 1],
    });
  }
  const meshes = spec.nodes.flatMap((node) => (node.mesh ? [boxMesh(index.get(node.name)!, node.mesh, index)] : []));
  return {
    format: 'fbx',
    nodes,
    meshes,
    clips: (spec.clips ?? []).map((clip): ModelClip => ({ ...clip, tracks: AnimationClip.toJSON(new AnimationClip(clip.name, clip.duration, [])) })),
    textures: spec.textures ?? [],
    unitScale: spec.unitScale ?? 1,
    upAxis: spec.upAxis ?? 'y',
    axisConversion: fbxAxisConversion(spec.upAxis === 'z' ? MAX_AXES : Y_UP_AXES),
    exportedFrom: spec.exportedFrom ?? null,
  };
}

/** The six faces of a box, as a file stores them: four corners each, every corner its own vertex. */
const FACES: { normal: [number, number, number]; corners: [number, number, number][] }[] = [
  { normal: [1, 0, 0], corners: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { normal: [-1, 0, 0], corners: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
  { normal: [0, 1, 0], corners: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
  { normal: [0, -1, 0], corners: [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]] },
  { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
];

function boxMesh(node: number, mesh: TestMesh, nodeIndex: Map<string, number>): ModelMesh {
  const [sx, sy, sz] = (mesh.size ?? [1, 1, 1]).map((value) => value / 2) as [number, number, number];
  const [cx, cy, cz] = mesh.center ?? [0, 0, 0];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const face of FACES) {
    // Two triangles per face, non-indexed: 0 1 2, 0 2 3.
    for (const corner of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z] = face.corners[corner]!;
      positions.push(cx + x * sx, cy + y * sy, cz + z * sz);
      normals.push(...face.normal);
      uvs.push(corner === 1 || corner === 2 ? 1 : 0, corner >= 2 ? 1 : 0);
    }
  }
  const vertexCount = positions.length / 3;
  const slots = mesh.slots ?? ['Default'];
  const facesPerSlot = Math.ceil(FACES.length / slots.length);
  return {
    node,
    attributes: {
      position: new Float32Array(positions),
      normal: mesh.normals === false ? null : new Float32Array(normals),
      uv: mesh.uv ? new Float32Array(uvs) : null,
      uv1: mesh.uv1 ? new Float32Array(uvs) : null,
      color: mesh.colors ? new Float32Array(vertexCount * 3).fill(1) : null,
      colorSize: 3,
      skinIndex: mesh.bones ? new Uint16Array(vertexCount * 4) : null,
      skinWeight: mesh.bones ? new Float32Array(vertexCount * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)) : null,
    },
    index: null,
    slots,
    groups: slots.map((_, slot) => ({ start: slot * facesPerSlot * 6, count: facesPerSlot * 6, slot })),
    skin: mesh.bones ? { bones: mesh.bones.map((bone) => nodeIndex.get(bone)!), boneInverses: new Float32Array(mesh.bones.length * 16) } : null,
    blendShapes: (mesh.blendShapes ?? []).map((name) => ({ name, deltas: new Float32Array(vertexCount * 3) })),
  };
}
