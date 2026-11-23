// Comments' spots on a model (`ModelSpot`, docs/features/code-reviews.md "Comments on 3D models"): what a click on a
// version writes, and where a spot written on any version shows on another. A spot's point is in the file's own space
// (before its units and axes become the viewer's, `viewerSpaceOf`), so any client places it alike; its part's names
// and the point in that part's space place it on the part wherever the part is now: another version, a take playing.

import { Matrix4, Vector3 } from 'three';
import type { ModelPoint, ModelSpot } from '@shared/domain/reviewConversation';
import { worldMatricesOf } from './modelSpaces';
import type { ModelNode, ParsedModel } from './parsedModel';
import type { Vector } from './orbitCamera';

/**
 * A node's names from the model's root down to it, the root's own left out, as a spot names its part: as the file
 * writes them (`fileName`), which another client reads, not as a loader renamed them.
 */
export function nodeNamesOf(nodes: readonly Pick<ModelNode, 'name' | 'fileName' | 'parent'>[], index: number): string[] {
  const names: string[] = [];
  for (let i = index; i >= 0 && nodes[i]!.parent >= 0; i = nodes[i]!.parent) names.unshift(nodes[i]!.fileName ?? nodes[i]!.name);
  return names;
}

/**
 * The node a spot's part is in a version: the one with its names. Of siblings that share a name (Unity allows them),
 * the one that places the spot's point nearest where it was written, as the point is on the part it was clicked on.
 * None for a spot that names no part, or a part this version hasn't.
 */
export function nodeOfSpot(model: Pick<ParsedModel, 'nodes'>, spot: ModelSpot): number | null {
  if (!spot.node) return null;
  const path = spot.node.path;
  const candidates = model.nodes.flatMap((node, index) => ((node.fileName ?? node.name) === path.at(-1) && sameNames(nodeNamesOf(model.nodes, index), path) ? [index] : []));
  if (candidates.length <= 1) return candidates[0] ?? null;
  const local = spot.node.local;
  if (!local) return candidates[0]!;
  const rest = worldMatricesOf({ nodes: model.nodes, unitScale: 1, importScale: 1, axisConversion: new Matrix4().elements }, new Matrix4());
  const written = vectorOf(spot.point);
  const distance = (index: number) => vectorOf(local).applyMatrix4(rest[index]!).distanceToSquared(written);
  return candidates.reduce((nearest, index) => (distance(index) < distance(nearest) ? index : nearest));
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/** Where a spot shows in a version, in the viewer's space, and whether the part it names is gone from that version. */
export interface PlacedSpot {
  point: Vector;
  partGone: boolean;
}

/**
 * Where a spot shows in a version: on its part as the part is drawn now (`nodeWorld`: the node's matrix to the
 * viewer's space, a take's pose included) when the version has it and the spot says where on it; else at its point in
 * the file's space, carried into the viewer's (`viewerSpace`). A point on a skinned mesh follows its node, not the skin.
 */
export function placedSpot(spot: ModelSpot, node: number | null, nodeWorld: (index: number) => Matrix4, viewerSpace: Matrix4): PlacedSpot {
  const local = spot.node?.local;
  const onPart = node !== null && local !== undefined;
  const point = onPart ? vectorOf(local).applyMatrix4(nodeWorld(node)) : vectorOf(spot.point).applyMatrix4(viewerSpace);
  return { point: point.toArray() as Vector, partGone: spot.node !== undefined && node === null };
}

/** What a click on a version marks a comment on: the point hit, the node of the mesh hit, and the camera then. */
export interface ModelPick {
  /** The point hit, in the viewer's space, as drawn. */
  point: Vector;
  /** The node of the mesh hit, its index in the model; none when no node is known. */
  node: number | null;
  /** Where the camera is, in the viewer's space. */
  camera: Vector;
}

/**
 * The spot a click writes (`ModelPick`): its point in the file's space, as the file has its part at rest (a take
 * playing moves the part, not where on it the comment is); its part's names and the point in the part's space; the
 * camera, as a direction from the point and a distance, in the file's space. `wholePart`: about the whole part.
 */
export function spotOfPick(model: ParsedModel, pick: ModelPick, nodeWorld: (index: number) => Matrix4, viewerSpace: Matrix4, wholePart = false): ModelSpot {
  const toFile = viewerSpace.clone().invert();
  const hit = new Vector3(...pick.point);
  const drawnInFile = hit.clone().applyMatrix4(toFile);
  const toCamera = new Vector3(...pick.camera).applyMatrix4(toFile).sub(drawnInFile);
  const distance = toCamera.length();
  const view = distance > 0 ? { view: { direction: pointOf(toCamera.divideScalar(distance)), distance } } : {};
  if (pick.node === null) return { point: pointOf(drawnInFile), ...view };
  const local = hit.clone().applyMatrix4(nodeWorld(pick.node).clone().invert());
  const rest = worldMatricesOf({ nodes: model.nodes, unitScale: 1, importScale: 1, axisConversion: new Matrix4().elements }, new Matrix4())[pick.node]!;
  return {
    point: pointOf(local.clone().applyMatrix4(rest)),
    node: { path: nodeNamesOf(model.nodes, pick.node), local: pointOf(local) },
    ...(wholePart && { wholePart: true as const }),
    ...view,
  };
}

function vectorOf({ x, y, z }: ModelPoint): Vector3 {
  return new Vector3(x, y, z);
}

function pointOf({ x, y, z }: Vector3): ModelPoint {
  return { x, y, z };
}
