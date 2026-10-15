// The Differences mode's changed regions, to step through as the image diff's are: patches of surface that moved past
// the tolerance, as a person sees them. A patch is the changed vertices joined through the mesh's own triangles (and
// its corners at one point, which a file stores apart), however coarse the mesh; then patches of either version whose
// boxes come within a few percent of the model of each other are one place to look at (what went from the version
// before, and what came to the version after there). Biggest first. Binning vertices into cells of a fixed size was
// tried first and dropped: on a coarse mesh, neighbours fell in cells apart and one sculpted side read as 30 regions.
// Found again as the tolerance settles (`useModelDifferences`), over millions of vertices: nothing here allocates per
// vertex or per triangle, and merging compares only the boxes that overlap along X (`NearRegions`), not every pair.

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
  return new NearRegions(modelSize * NEAR_SHARE)
    .merged(patches)
    .sort((a, b) => b.vertices - a.vertices || a.min[0] - b.min[0] || a.min[1] - b.min[1] || a.min[2] - b.min[2])
    .slice(0, MAX_REGIONS);
}

/** The mesh's changed vertices, joined through its triangles and its shared corners. */
function patchesOf({ positions, index, distances }: MeasuredMesh, within: number): ChangedRegion[] {
  const count = distances.length;
  const sets = new DisjointSets(count);
  const join = (a: number, b: number): void => {
    if (distances[a]! > within && distances[b]! > within) sets.union(a, b);
  };
  const corners = index?.length ?? count;
  for (let corner = 0; corner + 2 < corners; corner += 3) {
    const a = index ? index[corner]! : corner;
    const b = index ? index[corner + 1]! : corner + 1;
    const c = index ? index[corner + 2]! : corner + 2;
    join(a, b);
    join(b, c);
    join(c, a);
  }
  const changed: number[] = [];
  for (let v = 0; v < count; v++) if (distances[v]! > within) changed.push(v);
  joinSamePoints(positions, changed, (a, b) => sets.union(a, b));
  const patches = new Map<number, ChangedRegion>();
  for (const v of changed) {
    const [x, y, z] = [positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!];
    const root = sets.find(v);
    const patch = patches.get(root);
    if (!patch) {
      patches.set(root, { min: [x, y, z], max: [x, y, z], vertices: 1 });
      continue;
    }
    patch.min[0] = Math.min(patch.min[0], x);
    patch.min[1] = Math.min(patch.min[1], y);
    patch.min[2] = Math.min(patch.min[2], z);
    patch.max[0] = Math.max(patch.max[0], x);
    patch.max[1] = Math.max(patch.max[1], y);
    patch.max[2] = Math.max(patch.max[2], z);
    patch.vertices++;
  }
  return [...patches.values()];
}

/**
 * Joins the vertices of `vertices` that are at one point (to `SAME_POINT_STEP`), through a table of their rounded
 * coordinates open to probing: a key string per vertex cost more than all the rest on a model of millions.
 */
function joinSamePoints(positions: Float32Array, vertices: number[], join: (a: number, b: number) => void): void {
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, vertices.length * 2)));
  const slots = new Int32Array(size).fill(-1);
  const rounded = (v: number, axis: number): number => Math.round(positions[v * 3 + axis]! / SAME_POINT_STEP);
  for (const v of vertices) {
    const [x, y, z] = [rounded(v, 0), rounded(v, 1), rounded(v, 2)];
    let slot = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) & (size - 1);
    for (;;) {
      const other = slots[slot]!;
      if (other < 0) {
        slots[slot] = v;
        break;
      }
      if (rounded(other, 0) === x && rounded(other, 1) === y && rounded(other, 2) === z) {
        join(v, other);
        break;
      }
      slot = (slot + 1) & (size - 1);
    }
  }
}

/**
 * Regions merged while any two come within `near` of each other, as their boxes grow: passes of joining every pair
 * near now, until a pass joins none. A pass sorts the boxes along X and compares each only with those that start
 * before it ends there: merging pair by pair, starting over after each merge, took half a second for 3,000 patches.
 */
export class NearRegions {
  constructor(private readonly near: number) {}

  merged(patches: ChangedRegion[]): ChangedRegion[] {
    let regions = patches;
    for (;;) {
      const next = this.mergedOnce(regions);
      if (next.length === regions.length) return next;
      regions = next;
    }
  }

  /** Whether two boxes come within `near` of each other on every axis. */
  isNear(a: ChangedRegion, b: ChangedRegion): boolean {
    for (let axis = 0; axis < 3; axis++) {
      if (a.min[axis]! - this.near > b.max[axis]! || b.min[axis]! - this.near > a.max[axis]!) return false;
    }
    return true;
  }

  private mergedOnce(regions: ChangedRegion[]): ChangedRegion[] {
    const order = regions.map((_, i) => i).sort((a, b) => regions[a]!.min[0] - regions[b]!.min[0]);
    const sets = new DisjointSets(regions.length);
    order.forEach((i, at) => {
      const region = regions[i]!;
      for (let next = at + 1; next < order.length && regions[order[next]!]!.min[0] - this.near <= region.max[0]; next++) {
        if (this.isNear(region, regions[order[next]!]!)) sets.union(i, order[next]!);
      }
    });
    const merged = new Map<number, ChangedRegion>();
    regions.forEach((region, i) => {
      const root = sets.find(i);
      const into = merged.get(root);
      if (!into) {
        merged.set(root, { min: [...region.min], max: [...region.max], vertices: region.vertices });
        return;
      }
      for (let axis = 0; axis < 3; axis++) {
        into.min[axis] = Math.min(into.min[axis]!, region.min[axis]!);
        into.max[axis] = Math.max(into.max[axis]!, region.max[axis]!);
      }
      into.vertices += region.vertices;
    });
    return [...merged.values()];
  }
}

/** Union-find over 0…count-1, paths halved as they are walked. */
class DisjointSets {
  private readonly parent: Int32Array;

  constructor(count: number) {
    this.parent = new Int32Array(count);
    for (let i = 0; i < count; i++) this.parent[i] = i;
  }

  find(i: number): number {
    const parent = this.parent;
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  }

  union(a: number, b: number): void {
    const [rootA, rootB] = [this.find(a), this.find(b)];
    if (rootA !== rootB) this.parent[rootA] = rootB;
  }
}
