// The Differences mode's work on one pair of revisions, wherever it runs: in the worker (`imageDiff.worker`), or on
// the main thread when there is none (`imageDiffSession`). Both keep the last pair compared, so a new tolerance only
// renders the heatmap again.

import type { AnchorMode } from './imageDiff';
import { findChangedRegions, type ChangedRegion } from './changedRegions';
import { comparePixels, renderHeatmap, type PixelComparison, type RgbaBitmap } from './pixelComparison';

/** The heatmap at one tolerance, and the changed regions to step through at it. */
export interface RenderedHeatmap {
  pixels: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
  regions: ChangedRegion[];
}

/** A pair compared: its heatmap, and what the tolerance doesn't change (the histogram counts at any tolerance). */
export interface ComparedHeatmap extends RenderedHeatmap {
  coveredPixels: number;
  histogram: Uint32Array<ArrayBuffer>;
}

export interface HeatmapPasses {
  /** Compares a pair, named by `key` (`compositionKey`), and renders it at `tolerance`; the pair is kept. */
  compare(key: string, old: RgbaBitmap, next: RgbaBitmap, anchor: AnchorMode, tolerance: number): ComparedHeatmap;
  /** Renders the pair kept at another tolerance; null when the pair kept is another (compare it again). */
  rerender(key: string, tolerance: number): RenderedHeatmap | null;
}

export function heatmapPasses(): HeatmapPasses {
  let kept: { key: string; comparison: PixelComparison } | null = null;
  return {
    compare(key, old, next, anchor, tolerance) {
      const comparison = comparePixels(old, next, anchor);
      kept = { key, comparison };
      return { ...rendered(comparison, tolerance), coveredPixels: comparison.coveredPixels, histogram: comparison.histogram };
    },
    rerender(key, tolerance) {
      return kept?.key === key ? rendered(kept.comparison, tolerance) : null;
    },
  };
}

function rendered(comparison: PixelComparison, tolerance: number): RenderedHeatmap {
  const { width, height, difference } = comparison;
  return { pixels: renderHeatmap(comparison, tolerance), width, height, regions: findChangedRegions(difference, width, height, tolerance) };
}
