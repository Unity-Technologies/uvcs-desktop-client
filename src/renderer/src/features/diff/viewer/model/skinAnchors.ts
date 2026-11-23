// Where a comment's spot sits on a skinned mesh (a character, an antenna that sways). A take bends such a mesh by its
// bones and leaves its node where it is, so a spot placed by its node's matrix (`placedSpot`) would stay in the air as
// the surface moves away. Such a spot is anchored instead on the mesh's triangle nearest its point at rest, by where
// in that triangle the point is (barycentric weights): wherever the skeleton bends the triangle's three corners, the
// spot is that mix of them, still on the surface.
//
// A triangle rather than the nearest vertex: on a low-poly part (an antenna, a prop) the nearest corner can sit far
// from where the comment was written, and an offset kept from a vertex would point the wrong way once the bones turn
// it. The anchor needs nothing new stored: it is worked out from the spot's point at rest (`local`), so comments
// written before still follow the skin.

import { Matrix4, Triangle, Vector3, type SkinnedMesh } from 'three';
import { isSkinned, placedPositionsOf } from './meshPlacement';
import { worldMatricesOf } from './modelSpaces';
import type { ModelPoint } from '@shared/domain/reviewConversation';
import type { ModelMesh, ParsedModel } from './parsedModel';

/** A point on a skinned mesh: a triangle of it, and where in it. */
export interface SkinAnchor {
  /** The mesh, as an index in the model's meshes, which is its index in the scene's too (`ModelScene.meshes`). */
  mesh: number;
  /** The triangle's three vertices. */
  corners: [number, number, number];
  /** Each corner's share of the point, summing to 1. */
  weights: [number, number, number];
}

/** A mesh's vertices placed in one space, three floats apiece, with its triangles as the file indexes them. */
export interface PlacedMesh {
  mesh: number;
  positions: Float32Array;
  index: Uint32Array | null;
}

/** The skinned meshes hanging on a node, as indices in the model's meshes: none for a rigid part. */
export function skinnedMeshesOn(model: Pick<ParsedModel, 'meshes'>, node: number): number[] {
  return model.meshes.flatMap((mesh, i) => (mesh.node === node && isSkinned(mesh) ? [i] : []));
}

/**
 * The anchor of a spot on a node's skinned meshes: the one nearest the spot's point at rest (`local`, in the node's
 * space, which a take bending the skin doesn't move). None for a rigid part, or a spot that doesn't say where on its
 * part it is: its node's matrix places it (`placedSpot`). Reads every triangle of the meshes: once per pin and version.
 */
export function skinAnchorOfSpot(model: Pick<ParsedModel, 'nodes' | 'meshes'>, node: number, local: ModelPoint | undefined): SkinAnchor | null {
  const meshes = skinnedMeshesOn(model, node);
  if (meshes.length === 0 || !local) return null;
  const atRest = new Vector3(local.x, local.y, local.z).applyMatrix4(restWorldOf(model)[node]!);
  return nearestSkinAnchor(restMeshesOf(model, meshes), atRest);
}

/**
 * Where a point hit on a node's skinned meshes as they are drawn now (a take may bend them) sits with the skin at
 * rest, in the file's space: the same place on the same triangle. None for a rigid part: its node carries it.
 */
export function restPointOfHit(model: Pick<ParsedModel, 'nodes' | 'meshes'>, node: number, hit: Vector3, drawn: (mesh: number) => SkinnedMesh): Vector3 | null {
  const meshes = skinnedMeshesOn(model, node);
  const anchor = meshes.length === 0 ? null : nearestSkinAnchor(drawnMeshesOf(model, meshes, drawn), hit);
  return anchor && anchoredPoint(anchor, restMeshesOf(model, meshes));
}

/** Each node's matrix to the file's space with the model at rest, as a loader binds a skin. */
function restWorldOf(model: Pick<ParsedModel, 'nodes'>): Matrix4[] {
  const space = new Matrix4();
  return worldMatricesOf({ nodes: model.nodes, unitScale: 1, importScale: 1, axisConversion: space.elements }, space);
}

/** The meshes' vertices as the file has them at rest, its bones where the file puts them, in the file's own space. */
export function restMeshesOf(model: Pick<ParsedModel, 'nodes' | 'meshes'>, meshes: readonly number[]): PlacedMesh[] {
  const space = new Matrix4();
  const world = restWorldOf(model);
  return meshes.map((mesh) => placedMesh(model.meshes[mesh]!, mesh, placedPositionsOf(model.meshes[mesh]!, { space, world }, new Float32Array(model.meshes[mesh]!.attributes.position.length))));
}

/**
 * The meshes' vertices as they are drawn now, a take's pose and blendshapes included, in the viewer's space: what a
 * click on a posed mesh hit. `drawn` is each mesh as the scene draws it, skinned by the skeleton as last drawn.
 */
export function drawnMeshesOf(model: Pick<ParsedModel, 'meshes'>, meshes: readonly number[], drawn: (mesh: number) => SkinnedMesh): PlacedMesh[] {
  return meshes.map((mesh) => {
    const object = drawn(mesh);
    const count = model.meshes[mesh]!.attributes.position.length / 3;
    const positions = new Float32Array(count * 3);
    const vertex = new Vector3();
    for (let i = 0; i < count; i++) object.getVertexPosition(i, vertex).applyMatrix4(object.matrixWorld).toArray(positions, i * 3);
    return placedMesh(model.meshes[mesh]!, mesh, positions);
  });
}

function placedMesh(mesh: Pick<ModelMesh, 'index'>, index: number, positions: Float32Array): PlacedMesh {
  return { mesh: index, positions, index: mesh.index };
}

/** The anchor nearest a point (in the meshes' space): where the surface of all their triangles comes nearest it. None without a triangle. */
export function nearestSkinAnchor(meshes: readonly PlacedMesh[], point: Vector3): SkinAnchor | null {
  const triangle = new Triangle();
  const closest = new Vector3();
  const weights = new Vector3();
  let nearest: SkinAnchor | null = null;
  let nearestDistance = Infinity;
  for (const { mesh, positions, index } of meshes) {
    const triangles = (index ? index.length : positions.length / 3) / 3;
    for (let t = 0; t < triangles; t++) {
      const corners: [number, number, number] = index ? [index[t * 3]!, index[t * 3 + 1]!, index[t * 3 + 2]!] : [t * 3, t * 3 + 1, t * 3 + 2];
      triangle.a.fromArray(positions, corners[0] * 3);
      triangle.b.fromArray(positions, corners[1] * 3);
      triangle.c.fromArray(positions, corners[2] * 3);
      const distance = triangle.closestPointToPoint(point, closest).distanceToSquared(point);
      // A triangle with no area has no point inside to weigh: its neighbors hold the surface.
      if (distance >= nearestDistance || triangle.getBarycoord(closest, weights) === null) continue;
      nearestDistance = distance;
      nearest = { mesh, corners, weights: [weights.x, weights.y, weights.z] };
    }
  }
  return nearest;
}

/** Where an anchor is among a mesh's placed vertices (`restMeshesOf`, `drawnMeshesOf`), in their space. */
export function anchoredPoint(anchor: SkinAnchor, meshes: readonly PlacedMesh[]): Vector3 | null {
  const placed = meshes.find(({ mesh }) => mesh === anchor.mesh);
  if (!placed) return null;
  const point = new Vector3();
  const corner = new Vector3();
  anchor.corners.forEach((vertex, i) => point.addScaledVector(corner.fromArray(placed.positions, vertex * 3), anchor.weights[i]!));
  return point;
}

/**
 * Where an anchor is as the mesh is drawn now, in the viewer's space: its three corners skinned by the skeleton as
 * last drawn (three's `getVertexPosition`: blendshapes, then bones), placed by the mesh. Three vertices read, whatever
 * the mesh's size: this runs for every pin, every frame.
 */
export function drawnAnchorPoint(anchor: SkinAnchor, drawn: SkinnedMesh): Vector3 {
  const point = new Vector3();
  const corner = new Vector3();
  anchor.corners.forEach((vertex, i) => point.addScaledVector(drawn.getVertexPosition(vertex, corner), anchor.weights[i]!));
  return point.applyMatrix4(drawn.matrixWorld);
}
