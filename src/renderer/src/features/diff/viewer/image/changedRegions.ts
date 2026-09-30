// The changed regions the Differences mode's ‹ › step through: boxes around clusters of changed pixels, and which of
// them are worth stepping to. Pure, so it runs in the worker (`imageDiff.worker`) and is tested without a canvas.

import type { Size } from './imageDiff';

/** A box around one cluster of changed pixels, in the composed frame. */
export interface ChangedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Changed pixels inside the box. */
  pixels: number;
}

export interface RegionOptions {
  /** Clusters closer than this many pixels merge into one region. */
  mergeGap?: number;
  /** At most this many regions: the gap doubles until they fit, as dozens of stops would make stepping a chore. */
  maxRegions?: number;
  /** Past this many clusters the change is noise (dithering, recompression): one box around all of it instead. */
  maxClusters?: number;
}

/**
 * Clusters the pixels changed above the tolerance (8-connected, by a flood fill with an explicit stack) into boxes in
 * reading order; boxes close to each other merge, so one edit split by a few quiet pixels is one stop.
 */
export function findChangedRegions(difference: Uint8Array, width: number, height: number, tolerance: number, options: RegionOptions = {}): ChangedRegion[] {
  const { mergeGap = 8, maxRegions = 32, maxClusters = 1024 } = options;
  const changed = (pixel: number): boolean => difference[pixel]! > tolerance;
  const visited = new Uint8Array(difference.length);
  const stack: number[] = [];
  const clusters: ChangedRegion[] = [];

  for (let start = 0; start < difference.length; start++) {
    if (visited[start] || !changed(start)) continue;
    let minX = start % width;
    let maxX = minX;
    let minY = Math.floor(start / width);
    let maxY = minY;
    let pixels = 0;
    visited[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const pixel = stack.pop()!;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      pixels++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let neighbourY = Math.max(0, y - 1); neighbourY <= Math.min(height - 1, y + 1); neighbourY++) {
        for (let neighbourX = Math.max(0, x - 1); neighbourX <= Math.min(width - 1, x + 1); neighbourX++) {
          const neighbour = neighbourY * width + neighbourX;
          if (!visited[neighbour] && changed(neighbour)) {
            visited[neighbour] = 1;
            stack.push(neighbour);
          }
        }
      }
    }
    clusters.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixels });
    if (clusters.length > maxClusters) return [regionAroundAll(clusters, difference, tolerance)];
  }

  let gap = mergeGap;
  let regions = mergeCloseRegions(clusters, gap);
  while (regions.length > maxRegions) {
    gap *= 2;
    regions = mergeCloseRegions(regions, gap);
  }
  return regions.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * The regions worth stepping to: none when the only one covers (almost) the whole frame, as stepping to it would just
 * fit the view again. The slack tolerates thin quiet borders around an otherwise global change.
 */
export function steppableRegions(regions: ChangedRegion[], frame: Size): ChangedRegion[] {
  return regions.length === 1 && coversFrame(regions[0]!, frame) ? [] : regions;
}

/** The region a step goes to: the first (or last, going back) before any, then round and round. */
export function steppedRegion(current: number | null, direction: 1 | -1, count: number): number {
  if (current === null) return direction > 0 ? 0 : count - 1;
  return (current + direction + count) % count;
}

/** "3 regions" before stepping, "2 of 3" while stepping, "1 region" beside the arrows that zoom to it. */
export function regionCounter(count: number, current: number | null): string {
  if (count === 1) return '1 region';
  return current === null ? `${count} regions` : `${current + 1} of ${count}`;
}

function coversFrame(region: ChangedRegion, frame: Size, coverage = 0.9): boolean {
  return region.width >= frame.width * coverage && region.height >= frame.height * coverage;
}

/** One box around every cluster, its pixels counted anew: the flood fill stopped early. */
function regionAroundAll(clusters: ChangedRegion[], difference: Uint8Array, tolerance: number): ChangedRegion {
  const minX = Math.min(...clusters.map((cluster) => cluster.x));
  const minY = Math.min(...clusters.map((cluster) => cluster.y));
  const maxX = Math.max(...clusters.map((cluster) => cluster.x + cluster.width));
  const maxY = Math.max(...clusters.map((cluster) => cluster.y + cluster.height));
  let pixels = 0;
  for (const pixelDifference of difference) if (pixelDifference > tolerance) pixels++;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, pixels };
}

/** Merges boxes that overlap once grown by `gap`, until none do. */
function mergeCloseRegions(regions: ChangedRegion[], gap: number): ChangedRegion[] {
  const merged = [...regions];
  for (let pair = closePair(merged, gap); pair; pair = closePair(merged, gap)) {
    const [first, second] = pair;
    merged[first] = boxAround(merged[first]!, merged[second]!);
    merged.splice(second, 1);
  }
  return merged;
}

function closePair(regions: ChangedRegion[], gap: number): [number, number] | null {
  for (let first = 0; first < regions.length; first++) {
    for (let second = first + 1; second < regions.length; second++) {
      if (areClose(regions[first]!, regions[second]!, gap)) return [first, second];
    }
  }
  return null;
}

function areClose(a: ChangedRegion, b: ChangedRegion, gap: number): boolean {
  return a.x - gap < b.x + b.width && b.x - gap < a.x + a.width && a.y - gap < b.y + b.height && b.y - gap < a.y + a.height;
}

function boxAround(a: ChangedRegion, b: ChangedRegion): ChangedRegion {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
    pixels: a.pixels + b.pixels,
  };
}
