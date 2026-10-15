// The Differences mode's measure of a pair: each vertex of each version, how far from the other version's surface,
// in metres in the viewer's space. Both surfaces are taken whole (every mesh), so a mesh renamed, split or merged
// still compares by its shape, as the eye compares them; what no surface is near saturates at a tenth of the model.

import { placedPositionsOf, type PlaceableMesh } from './meshPlacement';
import { viewerSpaceOf, worldMatricesOf } from './modelSpaces';
import type { ParsedModel } from './parsedModel';
import { MeasurableSurface, surfaceDistances } from './surfaceDistance';

/** What placing a version's meshes takes of it: its nodes, units and axes, and each mesh's positions, skin and indices. */
export type PlaceableModel = Pick<ParsedModel, 'nodes' | 'unitScale' | 'importScale' | 'axisConversion'> & {
  meshes: (PlaceableMesh & { index: Uint32Array | null })[];
};

/** A version's meshes placed in the viewer's space: each mesh's vertices where they sit, and its triangles' corners. */
export interface PlacedMeshes {
  meshes: { positions: Float32Array; index: Uint32Array | null }[];
}

export interface SurfaceComparison {
  /** Per mesh of each version, in its vertices' order: the distance to the other version's surface. */
  before: Float32Array[];
  after: Float32Array[];
  /** The diagonal of both versions' bounds: tolerances and colors are told as shares of it. */
  size: number;
  /** The distance a vertex with nothing near is told as. */
  maxDistance: number;
}

/** What is far from everything is told as this share of the model. */
const SATURATION = 0.1;

/** The meshes of a version with their vertices moved where they sit in the viewer's space, as drawn at rest. */
export function placedMeshesOf(model: PlaceableModel): PlacedMeshes {
  const space = viewerSpaceOf(model);
  const placement = { space, world: worldMatricesOf(model, space) };
  return { meshes: model.meshes.map((mesh) => ({ positions: placedPositionsOf(mesh, placement, new Float32Array(mesh.attributes.position.length)), index: mesh.index })) };
}

export function compareSurfaces(before: PlacedMeshes, after: PlacedMeshes): SurfaceComparison {
  const size = diagonalOf([before, after]);
  const maxDistance = Math.max(size * SATURATION, 1e-9);
  // Each surface is made ready once for all the other version's meshes: once per mesh, a scene of thousands of meshes
  // read the whole other version thousands of times (minutes, in the one model worker every model read waits on).
  const surfaceBefore = MeasurableSurface.of({ positions: trianglesOf(before) });
  const surfaceAfter = MeasurableSurface.of({ positions: trianglesOf(after) });
  return {
    before: before.meshes.map((mesh) => surfaceDistances(mesh.positions, surfaceAfter, { maxDistance })),
    after: after.meshes.map((mesh) => surfaceDistances(mesh.positions, surfaceBefore, { maxDistance })),
    size,
    maxDistance,
  };
}

/** Every mesh's triangles, 9 floats each. */
/** How much of each version moved past the tolerance (shares of their vertices), and the farthest any moved. */
export function changeShares(comparison: SurfaceComparison, tolerance: number): { moved: number; gone: number; farthest: number } {
  const within = Math.fround(tolerance);
  const share = (meshes: Float32Array[]): number => {
    const total = meshes.reduce((sum, mesh) => sum + mesh.length, 0);
    const beyond = meshes.reduce((sum, mesh) => sum + mesh.filter((distance) => distance > within).length, 0);
    return total === 0 ? 0 : beyond / total;
  };
  const farthest = Math.max(0, ...[...comparison.before, ...comparison.after].map((mesh) => mesh.reduce((max, distance) => Math.max(max, distance), 0)));
  return { moved: share(comparison.after), gone: share(comparison.before), farthest };
}

function trianglesOf(placed: PlacedMeshes): Float32Array {
  const total = placed.meshes.reduce((sum, mesh) => sum + (mesh.index?.length ?? mesh.positions.length / 3) * 3, 0);
  const triangles = new Float32Array(total);
  let at = 0;
  for (const { positions, index } of placed.meshes) {
    const corners = index?.length ?? positions.length / 3;
    for (let corner = 0; corner < corners; corner++) {
      const vertex = index ? index[corner]! : corner;
      triangles[at++] = positions[vertex * 3]!;
      triangles[at++] = positions[vertex * 3 + 1]!;
      triangles[at++] = positions[vertex * 3 + 2]!;
    }
  }
  return triangles;
}

function diagonalOf(versions: PlacedMeshes[]): number {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const version of versions) {
    for (const { positions } of version.meshes) {
      for (let i = 0; i < positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis]!, positions[i + axis]!);
          max[axis] = Math.max(max[axis]!, positions[i + axis]!);
        }
      }
    }
  }
  return min[0] === Infinity ? 0 : Math.hypot(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!);
}
