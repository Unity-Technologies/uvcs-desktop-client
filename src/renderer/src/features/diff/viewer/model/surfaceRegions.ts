// The Differences mode's changed regions, to step through as the image diff's are: patches of surface that moved past
// the tolerance, as a person sees them. A patch is the changed vertices joined through the mesh's own triangles (and
// its corners at one point, which a file stores apart), however coarse the mesh; then patches of either version whose
// boxes come within a few percent of the model of each other are one place to look at (what went from the version
// before, and what came to the version after there). Biggest first. Binning vertices into cells of a fixed size was
// tried first and dropped: on a coarse mesh, neighbours fell in cells apart and one sculpted side read as 30 regions.

import type { Vector } from './orbitCamera';

export interface ChangedRegion {
  min: Vector;
  max: Vector;
  /** How many changed vertices it holds: what it is sorted by. */
  vertices: number;
}

/** A version's placed vertices, its triangles (`index`, or every three vertices) and their distances to the other version. */
export interface MeasuredMesh {
  positions: Float32Array;
  index: Uint32Array | null;
  distances: Float32Array;
}

/** Patches this share of the model apart, or nearer, are one place to look at. */
const NEAR_SHARE = 0.03;
/** More regions than this is the whole model changing: stepping through them all helps no one. */
export const MAX_REGIONS = 30;
/** Corners this close are one point. */
const SAME_POINT_STEP = 1e-6;

export function changedRegions(meshes: MeasuredMesh[], tolerance: number, modelSize: number): ChangedRegion[] {
  const within = Math.fround(tolerance);
  const patches = meshes.flatMap((mesh) => patchesOf(mesh, within));
  return mergedNear(patches, modelSize * NEAR_SHARE)
    .sort((a, b) => b.vertices - a.vertices)
    .slice(0, MAX_REGIONS);
}

/** The mesh's changed vertices, joined through its triangles and its shared corners. */
function patchesOf({ positions, index, distances }: MeasuredMesh, within: number): ChangedRegion[] {
  const count = distances.length;
  const changed = (v: number): boolean => distances[v]! > within;
  const parent = new Int32Array(count).map((_, v) => v);
  const find = (v: number): number => {
    while (parent[v] !== v) {
      parent[v] = parent[parent[v]!]!;
      v = parent[v]!;
    }
    return v;
  };
  const join = (a: number, b: number): void => {
    if (changed(a) && changed(b)) parent[find(a)] = find(b);
  };
  const corners = index?.length ?? count;
  for (let corner = 0; corner + 2 < corners; corner += 3) {
    const [a, b, c] = index ? [index[corner]!, index[corner + 1]!, index[corner + 2]!] : [corner, corner + 1, corner + 2];
    join(a, b);
    join(b, c);
    join(c, a);
  }
  const atPoint = new Map<string, number>();
  for (let v = 0; v < count; v++) {
    if (!changed(v)) continue;
    const key = `${Math.round(positions[v * 3]! / SAME_POINT_STEP)},${Math.round(positions[v * 3 + 1]! / SAME_POINT_STEP)},${Math.round(positions[v * 3 + 2]! / SAME_POINT_STEP)}`;
    const other = atPoint.get(key);
    if (other === undefined) atPoint.set(key, v);
    else join(v, other);
  }
  const patches = new Map<number, ChangedRegion>();
  for (let v = 0; v < count; v++) {
    if (!changed(v)) continue;
    const point: Vector = [positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!];
    const root = find(v);
    const patch = patches.get(root);
    if (patch) grow(patch, point, 1);
    else patches.set(root, { min: [...point], max: [...point], vertices: 1 });
  }
  return [...patches.values()];
}

/** Patches merged while any two come within `near` of each other. */
function mergedNear(patches: ChangedRegion[], near: number): ChangedRegion[] {
  const regions = [...patches];
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < regions.length && !merged; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        if (!within(regions[i]!, regions[j]!, near)) continue;
        grow(regions[i]!, regions[j]!.min, 0);
        grow(regions[i]!, regions[j]!.max, regions[j]!.vertices);
        regions.splice(j, 1);
        merged = true;
        break;
      }
    }
  }
  return regions;
}

function within(a: ChangedRegion, b: ChangedRegion, near: number): boolean {
  return [0, 1, 2].every((axis) => a.min[axis]! - near <= b.max[axis]! && b.min[axis]! - near <= a.max[axis]!);
}

function grow(region: ChangedRegion, point: Vector, vertices: number): void {
  for (let axis = 0; axis < 3; axis++) {
    region.min[axis] = Math.min(region.min[axis]!, point[axis]!);
    region.max[axis] = Math.max(region.max[axis]!, point[axis]!);
  }
  region.vertices += vertices;
}
