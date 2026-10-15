import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { steppedRegion } from '../image/changedRegions';
import { fullHeatAt } from './heatColors';
import type { ModelRenderer } from './modelRenderer';
import type { BoundsLike } from './orbitCamera';
import type { ParsedModel } from './parsedModel';
import { boxedRegion } from './regionView';
import { placedMeshesOf } from './surfaceComparison';
import { changedRegions, type ChangedRegion } from './surfaceRegions';
import { useSurfaceComparison } from './useSurfaceComparison';

interface DifferencesInput {
  renderer: ModelRenderer | null;
  before: ParsedModel | null;
  after: ParsedModel | null;
  /** The Differences mode is on. */
  wanted: boolean;
  /** The tolerance, as a share of the model's size. */
  toleranceShare: number;
  /** Takes the camera to a changed region, turned to face it (`regionView`). */
  frameRegion: (region: BoundsLike) => void;
}

/**
 * The Differences mode: the pair's surfaces compared in the worker, colored at the tolerance on the GPU (`heatColors`),
 * and its changed regions to step through, each faced, framed and boxed. The slider and the colors move at once; the
 * regions and the figures of millions of vertices follow when React has the time (`useDeferredValue`).
 */
export function useModelDifferences({ renderer, before, after, wanted, toleranceShare, frameRegion }: DifferencesInput) {
  const { comparison, comparing, failed } = useSurfaceComparison(before, after, wanted);
  const tolerance = useDeferredValue(comparison ? toleranceShare * comparison.size : 0);

  useEffect(() => {
    renderer?.setHeat(comparison && { before: comparison.before, after: comparison.after });
  }, [renderer, comparison]);
  useEffect(() => {
    if (!renderer || !comparison) return;
    const shown = toleranceShare * comparison.size;
    renderer.setHeatTolerance(shown, fullHeatAt(shown, comparison.size));
  }, [renderer, comparison, toleranceShare]);

  const placed = useMemo(() => (comparison && before && after ? { before: placedMeshesOf(before), after: placedMeshesOf(after) } : null), [comparison, before, after]);
  const regions = useMemo(() => {
    if (!placed || !comparison) return [];
    const measured = (side: 'before' | 'after') => placed[side].meshes.map((mesh, i) => ({ positions: mesh.positions, index: mesh.index, distances: comparison[side][i]! }));
    return changedRegions([...measured('after'), ...measured('before')], tolerance, comparison.size);
  }, [placed, comparison, tolerance]);

  // The region stepped to, among the regions it was stepped in: the slider finding others starts over.
  const [stepped, setStepped] = useState<{ regions: ChangedRegion[]; index: number } | null>(null);
  const currentRegion = wanted && stepped?.regions === regions ? stepped.index : null;
  useEffect(() => {
    const region = currentRegion === null ? null : regions[currentRegion];
    renderer?.setRegion(region ? boxedRegion(region, comparison?.size ?? 0) : null);
  }, [renderer, regions, currentRegion, comparison]);
  const stepRegion = (direction: 1 | -1): void => {
    if (regions.length === 0) return;
    const index = steppedRegion(currentRegion, direction, regions.length);
    setStepped({ regions, index });
    frameRegion(regions[index]!);
  };

  return { comparison, comparing, failed, tolerance, regions, currentRegion, stepRegion };
}
