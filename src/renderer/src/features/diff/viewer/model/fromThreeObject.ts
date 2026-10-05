// A loader's three.js objects as a `ParsedModel`: the hierarchy in order, each mesh's attributes as floats, its
// material slots, skin and blendshapes, and the takes as clip JSON. Only what the diff reads is kept, and the arrays
// already in floats are kept as they are, so a big mesh crosses from the worker without a copy.

import { AnimationClip, type BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute, type Material, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import type { BlendShape, MeshAttributes, MeshGroup, ModelClip, ModelMesh, ModelNode, ModelNodeKind, ParsedModel } from './parsedModel';

/** What the loader told besides the objects (`parseModel` reads it from the file). */
export type ModelFileFacts = Pick<ParsedModel, 'format' | 'textures' | 'unitScale' | 'upAxis' | 'axisConversion' | 'exportedFrom'>;

type AnyAttribute = BufferAttribute | InterleavedBufferAttribute;

export function fromThreeObject(root: Object3D, animations: AnimationClip[], facts: ModelFileFacts): ParsedModel {
  const nodes: ModelNode[] = [];
  const meshes: ModelMesh[] = [];
  const indexOf = new Map<Object3D, number>();
  const skinned: { mesh: SkinnedMesh; parsed: ModelMesh }[] = [];

  visit(root, -1);
  // Bones are nodes of the hierarchy, found anywhere in it: their indices are known once every node is.
  for (const { mesh, parsed } of skinned) parsed.skin = skinOf(mesh, indexOf);

  return { ...facts, nodes, meshes, clips: animations.map(clipOf) };

  function visit(object: Object3D, parent: number): void {
    // FBXLoader adds the file's ambient color as a light of the scene: a setting of the file, not a node of the model.
    if (object.type === 'AmbientLight') return;
    const index = nodes.length;
    indexOf.set(object, index);
    nodes.push({
      name: nameOf(object),
      parent,
      kind: kindOf(object),
      position: object.position.toArray(),
      rotation: object.quaternion.toArray() as ModelNode['rotation'],
      scale: object.scale.toArray(),
    });
    if (isMesh(object)) {
      const parsed = meshOf(object as Mesh, index);
      meshes.push(parsed);
      if ((object as SkinnedMesh).isSkinnedMesh) skinned.push({ mesh: object as SkinnedMesh, parsed });
    }
    for (const child of object.children) visit(child, index);
  }
}

/**
 * The node's name as the file has it, which is what Unity names its GameObject. FBXLoader names the object for
 * animation bindings instead (`PropertyBinding.sanitizeNodeName`: `Hand L` becomes `Hand_L`, dots and colons go) and
 * keeps the file's in `userData.originalName`.
 */
function nameOf(object: Object3D): string {
  const original: unknown = object.userData.originalName;
  return typeof original === 'string' ? original : object.name;
}

function kindOf(object: Object3D): ModelNodeKind {
  if ((object as SkinnedMesh).isSkinnedMesh) return 'skinnedMesh';
  if (isMesh(object)) return 'mesh';
  if ((object as { isBone?: boolean }).isBone) return 'bone';
  if ((object as { isLight?: boolean }).isLight) return 'light';
  if ((object as { isCamera?: boolean }).isCamera) return 'camera';
  return 'group';
}

/** Triangle meshes only: lines and points a file may hold (curves, helpers) aren't meshes Unity imports. */
function isMesh(object: Object3D): boolean {
  return (object as Mesh).isMesh === true;
}

function meshOf(mesh: Mesh, node: number): ModelMesh {
  const geometry = mesh.geometry;
  const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const color = geometry.getAttribute('color') as AnyAttribute | undefined;
  const attributes: MeshAttributes = {
    position: floatsOf(geometry.getAttribute('position') as AnyAttribute, 3),
    normal: optionalFloats(geometry, 'normal', 3),
    uv: optionalFloats(geometry, 'uv', 2),
    uv1: optionalFloats(geometry, 'uv1', 2),
    color: color ? floatsOf(color, color.itemSize === 4 ? 4 : 3) : null,
    colorSize: color?.itemSize === 4 ? 4 : 3,
    skinIndex: skinIndexOf(geometry),
    skinWeight: optionalFloats(geometry, 'skinWeight', 4),
  };
  return {
    node,
    attributes,
    index: geometry.index ? Uint32Array.from(geometry.index.array) : null,
    slots: materials.map((material) => material.name),
    groups: groupsOf(geometry, attributes.position.length / 3),
    skin: null,
    blendShapes: blendShapesOf(mesh),
  };
}

/** A mesh without groups draws all of itself with its one material. */
function groupsOf(geometry: BufferGeometry, vertexCount: number): MeshGroup[] {
  if (geometry.groups.length === 0) return [{ start: 0, count: geometry.index?.count ?? vertexCount, slot: 0 }];
  return geometry.groups.map((group) => ({ start: group.start, count: group.count, slot: group.materialIndex ?? 0 }));
}

function optionalFloats(geometry: BufferGeometry, name: string, itemSize: number): Float32Array | null {
  const attribute = geometry.getAttribute(name) as AnyAttribute | undefined;
  return attribute ? floatsOf(attribute, itemSize) : null;
}

/**
 * The attribute as tightly packed floats. One already stored so is taken as it is (no copy for the worker to make);
 * one interleaved, quantized or normalized (glTF's `KHR_mesh_quantization`) is read value by value.
 */
function floatsOf(attribute: AnyAttribute, itemSize: number): Float32Array {
  const array = (attribute as BufferAttribute).array;
  const packed = !(attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute && !attribute.normalized;
  if (packed && array instanceof Float32Array && attribute.itemSize === itemSize) return array;
  const floats = new Float32Array(attribute.count * itemSize);
  const getters = [attribute.getX, attribute.getY, attribute.getZ, attribute.getW];
  for (let i = 0; i < attribute.count; i++) {
    for (let component = 0; component < itemSize; component++) {
      floats[i * itemSize + component] = component < attribute.itemSize ? getters[component]!.call(attribute, i) : 0;
    }
  }
  return floats;
}

function skinIndexOf(geometry: BufferGeometry): Uint16Array | null {
  const attribute = geometry.getAttribute('skinIndex') as AnyAttribute | undefined;
  if (!attribute) return null;
  return Uint16Array.from(floatsOf(attribute, 4));
}

function skinOf(mesh: SkinnedMesh, indexOf: Map<Object3D, number>): ModelMesh['skin'] {
  const { bones, boneInverses } = mesh.skeleton;
  const inverses = new Float32Array(boneInverses.length * 16);
  boneInverses.forEach((matrix, i) => inverses.set(matrix.elements, i * 16));
  return { bones: bones.map((bone) => indexOf.get(bone) ?? -1), boneInverses: inverses };
}

/** Each blendshape as offsets from the base shape: FBX and glTF store them so, others as whole shapes. */
function blendShapesOf(mesh: Mesh): BlendShape[] {
  const geometry = mesh.geometry;
  const targets = (geometry.morphAttributes.position ?? []) as AnyAttribute[];
  if (targets.length === 0) return [];
  const names = namesByIndex(mesh.morphTargetDictionary, targets.length);
  const base = geometry.getAttribute('position') as AnyAttribute;
  return targets.map((target, i) => {
    const deltas = floatsOf(target, 3);
    if (!geometry.morphTargetsRelative) {
      const offsets = new Float32Array(deltas.length);
      for (let v = 0; v < base.count; v++) {
        offsets[v * 3] = deltas[v * 3]! - base.getX(v);
        offsets[v * 3 + 1] = deltas[v * 3 + 1]! - base.getY(v);
        offsets[v * 3 + 2] = deltas[v * 3 + 2]! - base.getZ(v);
      }
      return { name: names[i]!, deltas: offsets };
    }
    return { name: names[i]!, deltas };
  });
}

function namesByIndex(dictionary: Record<string, number> | undefined, count: number): string[] {
  const names = Array.from({ length: count }, (_, i) => `Shape ${i + 1}`);
  for (const [name, index] of Object.entries(dictionary ?? {})) if (index < count) names[index] = name;
  return names;
}

function clipOf(clip: AnimationClip): ModelClip {
  return { name: clip.name, duration: clip.duration, tracks: AnimationClip.toJSON(clip) };
}
