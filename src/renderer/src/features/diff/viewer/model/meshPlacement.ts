// Where a mesh's vertices sit, as the viewer draws the model at rest (`buildModelScene`): through its node, or,
// skinned, through its bones as the file's loader bound it (`bindSkin`). What the panel measures (`modelSummary`) and
// the Differences mode compares (`placedMeshesOf`) is so what the eye sees: a weapon bound upright and held across by
// the rest pose is measured across, and a Sketchfab glTF, whose skinned mesh's node isn't where it is, where it is.

import { Matrix4 } from 'three';
import type { MeshAttributes, ModelMesh } from './parsedModel';

/** What placing a mesh takes: its node, its skin, and its positions with their bones and weights. */
export type PlaceableMesh = Pick<ModelMesh, 'node' | 'skin'> & { attributes: Pick<MeshAttributes, 'position' | 'skinIndex' | 'skinWeight'> };

/** Floats to place into: singles for drawing and comparing (`placedMeshesOf`), doubles for fingerprints (`modelSummary`). */
export type PlacedArray = Float32Array | Float64Array;

/** A space to place in, and each node's matrix into it (`worldMatricesOf`). */
export interface NodePlacement {
  space: Matrix4;
  world: Matrix4[];
}

/**
 * The mesh's vertices in the placement's space, written into `into` (as long as the positions) and returned. In doubles, a rigid mesh a kilometre across is placed
 * to the micrometre; a skinned one only as well as its inverse bind matrices, which files keep in singles.
 */
export function placedPositionsOf<T extends PlacedArray>(mesh: PlaceableMesh, { space, world }: NodePlacement, into: T): T {
  const { position, skinIndex, skinWeight } = mesh.attributes;
  if (!isSkinned(mesh)) return transformed(position, world[mesh.node]!.elements, into);
  return skinned(position, skinningMatrices(mesh.skin!, space, world), skinIndex!, skinWeight!, into);
}

/** Placed by its bones: a skin, and bones and weights for its vertices (`buildModelScene` skins the same ones). */
export function isSkinned(mesh: PlaceableMesh): boolean {
  return mesh.skin !== null && mesh.attributes.skinIndex !== null && mesh.attributes.skinWeight !== null;
}

/**
 * Where the mesh is placed at rest, which a turn or a scale of the whole model turns or scales: its node's world, or,
 * skinned, the frame its top-most joint carries the bound mesh to (`joint's world × inverse bind × bind matrix`), so
 * whatever turns or scales the skeleton from above turns it, and a glTF's mesh node turned alone (it places nothing)
 * doesn't. The top-most joint, not the heaviest: it carries the whole skeleton, and repainting weights doesn't change
 * it. A rest pose turning that joint reads as the whole model turned, as Unity shows it.
 */
export function restingPlacementOf(mesh: PlaceableMesh, { space, world }: NodePlacement): Matrix4 {
  if (!isSkinned(mesh)) return world[mesh.node]!.clone();
  const skin = mesh.skin!;
  const bound = new Matrix4().fromArray(skin.bindMatrix);
  const top = topJointOf(skin.bones);
  if (top === -1) return space.clone().multiply(bound);
  return world[skin.bones[top]!]!.clone().multiply(new Matrix4().fromArray(skin.boneInverses, top * 16)).multiply(bound);
}

/** The joint (its index in the skin) first in node order: parents come before children, so nothing above it is a joint. -1 when no joint is a node. */
function topJointOf(bones: number[]): number {
  let top = -1;
  bones.forEach((node, i) => {
    if (node >= 0 && (top === -1 || node < bones[top]!)) top = i;
  });
  return top;
}

/**
 * Each bone's matrix from the bound vertices to the space: `bone's world × inverse bind × bind matrix`. A joint that
 * isn't a node of the model (a loader's stand-in) stands where it was bound, holding its share of a vertex where the
 * bind matrix puts it, as `bindSkin` draws it.
 */
function skinningMatrices(skin: NonNullable<ModelMesh['skin']>, space: Matrix4, world: Matrix4[]): number[][] {
  const bindMatrix = new Matrix4().fromArray(skin.bindMatrix);
  return skin.bones.map((bone, i) => {
    const boneWorld = world[bone];
    if (!boneWorld) return space.clone().multiply(bindMatrix).elements;
    return boneWorld.clone().multiply(new Matrix4().fromArray(skin.boneInverses, i * 16)).multiply(bindMatrix).elements;
  });
}

/** Each vertex by its four bones' matrices, weighted as three skins it (weights as the file has them, unnormalized). */
function skinned<T extends PlacedArray>(positions: Float32Array, matrices: number[][], indices: Uint16Array, weights: Float32Array, into: T): T {
  const point = [0, 0, 0];
  for (let v = 0, i = 0; i < positions.length; v++, i += 3) {
    into[i] = into[i + 1] = into[i + 2] = 0;
    for (let influence = v * 4; influence < v * 4 + 4; influence++) {
      const weight = weights[influence]!;
      const matrix = matrices[indices[influence]!];
      if (weight === 0 || !matrix) continue;
      timesPoint(matrix, positions, i, point);
      into[i] += weight * point[0]!;
      into[i + 1] += weight * point[1]!;
      into[i + 2] += weight * point[2]!;
    }
  }
  return into;
}

function transformed<T extends PlacedArray>(positions: Float32Array, matrix: number[], into: T): T {
  const point = [0, 0, 0];
  for (let i = 0; i < positions.length; i += 3) {
    timesPoint(matrix, positions, i, point);
    into[i] = point[0]!;
    into[i + 1] = point[1]!;
    into[i + 2] = point[2]!;
  }
  return into;
}

/** A column-major 4×4 affine matrix times the point at `positions[i]`, into `point`. */
function timesPoint(m: number[], positions: Float32Array, i: number, point: number[]): void {
  const x = positions[i]!;
  const y = positions[i + 1]!;
  const z = positions[i + 2]!;
  point[0] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  point[1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  point[2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
}
