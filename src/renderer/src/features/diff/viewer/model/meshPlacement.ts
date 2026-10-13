// Where a mesh's vertices sit, as the viewer draws the model at rest (`buildModelScene`): through its node, or,
// skinned, through its bones as the file's loader bound it (`bindSkin`). What the panel measures (`modelSummary`) and
// the Differences mode compares (`placedMeshesOf`) is so what the eye sees: a weapon bound upright and held across by
// the rest pose is measured across, and a Sketchfab glTF, whose skinned mesh's node isn't where it is, where it is.

import { Matrix4 } from 'three';
import type { MeshAttributes, ModelMesh } from './parsedModel';

/** What placing a mesh takes: its node, its skin, and its positions with their bones and weights. */
export type PlaceableMesh = Pick<ModelMesh, 'node' | 'skin'> & { attributes: Pick<MeshAttributes, 'position' | 'skinIndex' | 'skinWeight'> };

/**
 * The mesh's vertices in the space `world` (each node's matrix into it, `worldMatricesOf`) places the nodes in, in
 * doubles: a model a kilometre across still places them to the micrometre (`modelSummary` fingerprints them).
 */
export function placedPositionsOf(mesh: PlaceableMesh, world: Matrix4[]): Float64Array {
  const { position, skinIndex, skinWeight } = mesh.attributes;
  if (!mesh.skin || !skinIndex || !skinWeight) return transformed(position, world[mesh.node]!.elements);
  return skinned(position, skinningMatrices(mesh.skin, world, mesh.node), skinIndex, skinWeight);
}

/**
 * Each bone's matrix from the bound vertices to the space: `bone's world × inverse bind × bind matrix`. A bone that
 * isn't a node of the model (a loader's stand-in) leaves its share of a vertex where the mesh's node puts it.
 */
function skinningMatrices(skin: NonNullable<ModelMesh['skin']>, world: Matrix4[], node: number): number[][] {
  const bindMatrix = new Matrix4().fromArray(skin.bindMatrix);
  return skin.bones.map((bone, i) => {
    const boneWorld = world[bone];
    if (!boneWorld) return world[node]!.elements;
    return boneWorld.clone().multiply(new Matrix4().fromArray(skin.boneInverses, i * 16)).multiply(bindMatrix).elements;
  });
}

/** Each vertex by its four bones' matrices, weighted as three skins it (weights as the file has them, unnormalized). */
function skinned(positions: Float32Array, matrices: number[][], indices: Uint16Array, weights: Float32Array): Float64Array {
  const placed = new Float64Array(positions.length);
  for (let v = 0, i = 0; i < positions.length; v++, i += 3) {
    const x = positions[i]!;
    const y = positions[i + 1]!;
    const z = positions[i + 2]!;
    let px = 0;
    let py = 0;
    let pz = 0;
    for (let influence = v * 4; influence < v * 4 + 4; influence++) {
      const weight = weights[influence]!;
      const m = matrices[indices[influence]!];
      if (weight === 0 || !m) continue;
      px += weight * (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!);
      py += weight * (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!);
      pz += weight * (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!);
    }
    placed[i] = px;
    placed[i + 1] = py;
    placed[i + 2] = pz;
  }
  return placed;
}

function transformed(positions: Float32Array, m: number[]): Float64Array {
  const placed = new Float64Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!;
    const y = positions[i + 1]!;
    const z = positions[i + 2]!;
    placed[i] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    placed[i + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    placed[i + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  }
  return placed;
}
