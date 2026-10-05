// The Differences mode's changed regions, to step through as the image diff's are: the vertices of either version
// farther than the tolerance from the other's surface, binned into cells of a few percent of the model and joined
// where cells touch (faces, edges or corners). Biggest first: the sculpted face before the nudged ear.

import type { Vector } from './orbitCamera';

export interface ChangedRegion {
  min: Vector;
  max: Vector;
  /** How many changed vertices it holds: what it is sorted by. */
  vertices: number;
}

/** A version's placed vertices and their distances to the other version, one entry per mesh. */
export interface MeasuredMesh {
  positions: Float32Array;
  distances: Float32Array;
}

/** A region is joined of cells this share of the model wide: what reads as one place to look at. */
const CELL_SHARE = 0.03;
/** More regions than this is the whole model changing: stepping through them all helps no one. */
export const MAX_REGIONS = 30;

export function changedRegions(meshes: MeasuredMesh[], tolerance: number, modelSize: number): ChangedRegion[] {
  const cell = Math.max(modelSize * CELL_SHARE, 1e-9);
  const cells = new Map<string, { at: [number, number, number]; region: ChangedRegion }>();
  // Compared as the distances are stored, in float32.
  const within = Math.fround(tolerance);
  for (const { positions, distances } of meshes) {
    for (let v = 0; v < distances.length; v++) {
      if (distances[v]! <= within) continue;
      const point: Vector = [positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!];
      const at = point.map((value) => Math.floor(value / cell)) as [number, number, number];
      const key = at.join(',');
      const found = cells.get(key);
      if (found) grow(found.region, point);
      else cells.set(key, { at, region: { min: [...point], max: [...point], vertices: 1 } });
    }
  }
  return joined(cells).sort((a, b) => b.vertices - a.vertices).slice(0, MAX_REGIONS);
}

function grow(region: ChangedRegion, point: Vector): void {
  for (let axis = 0; axis < 3; axis++) {
    region.min[axis] = Math.min(region.min[axis]!, point[axis]!);
    region.max[axis] = Math.max(region.max[axis]!, point[axis]!);
  }
  region.vertices++;
}

/** The cells' regions merged where cells touch, by a flood over each cell's 26 neighbours. */
function joined(cells: Map<string, { at: [number, number, number]; region: ChangedRegion }>): ChangedRegion[] {
  const seen = new Set<string>();
  const regions: ChangedRegion[] = [];
  for (const [start, { region: first }] of cells) {
    if (seen.has(start)) continue;
    seen.add(start);
    const region: ChangedRegion = { min: [...first.min], max: [...first.max], vertices: 0 };
    const pending = [start];
    while (pending.length > 0) {
      const key = pending.pop()!;
      const { at, region: part } = cells.get(key)!;
      for (let axis = 0; axis < 3; axis++) {
        region.min[axis] = Math.min(region.min[axis]!, part.min[axis]!);
        region.max[axis] = Math.max(region.max[axis]!, part.max[axis]!);
      }
      region.vertices += part.vertices;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const neighbour = `${at[0] + dx},${at[1] + dy},${at[2] + dz}`;
            if (!seen.has(neighbour) && cells.has(neighbour)) {
              seen.add(neighbour);
              pending.push(neighbour);
            }
          }
        }
      }
    }
    regions.push(region);
  }
  return regions;
}
