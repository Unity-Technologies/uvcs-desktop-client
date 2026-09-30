import { useEffect, useRef, useState, type RefObject } from 'react';
import { compositionKey } from './compositionKey';
import type { AnchorMode } from './composedFrame';
import { compareImages, rerenderHeatmap, type ComparedImages } from './imageDiffSession';
import { rasterize } from './rasterize';
import type { DecodedImage } from './useDecodedImage';

/** A pair's heatmap, kept by the viewer across mode switches (one at a time). */
export interface CachedHeatmap extends ComparedImages {
  /** The pair and anchor it is of (`compositionKey`). */
  key: string;
  /** The tolerance it was rendered at. */
  tolerance: number;
}

/** How long the tolerance rests before the heatmap renders again: the slider streams values. */
const TOLERANCE_PAUSE_MS = 60;

interface HeatmapRequest {
  oldImage: DecodedImage;
  newImage: DecodedImage;
  anchor: AnchorMode;
  tolerance: number;
  cache: RefObject<CachedHeatmap | null>;
}

/**
 * The heatmap of a pair at the tolerance: compared once per pair and anchor (from the viewer's cache when it has it),
 * rendered again as the tolerance moves. `heatmap` is null until the pair's first one is ready.
 */
export function useHeatmap({ oldImage, newImage, anchor, tolerance, cache }: HeatmapRequest): { heatmap: CachedHeatmap | null; comparing: boolean } {
  const [heatmap, setHeatmap] = useState<CachedHeatmap | null>(null);
  const [comparing, setComparing] = useState(false);
  // A comparison starts at the tolerance of the moment; later moves render again instead of comparing again.
  const toleranceNow = useRef(tolerance);
  toleranceNow.current = tolerance;
  const key = compositionKey(oldImage, newImage, anchor);

  // A new pair or anchor: compared.
  useEffect(() => {
    let stale = false;
    const adopt = (next: CachedHeatmap): void => {
      if (stale) return;
      cache.current = next;
      setHeatmap(next);
      setComparing(false);
    };
    if (cache.current?.key === key) {
      adopt(cache.current);
      return;
    }
    setComparing(true);
    // A frame first, so the mode shows before rasterizing (the one step on the main thread: it needs a canvas).
    const frame = requestAnimationFrame(async () => {
      const at = toleranceNow.current;
      adopt({ key, tolerance: at, ...(await compareImages(key, rasterize(oldImage), rasterize(newImage), anchor, at)) });
    });
    return () => {
      stale = true;
      cancelAnimationFrame(frame);
    };
  }, [key, oldImage, newImage, anchor, cache]);

  // The tolerance moved: rendered again from the pair kept, once it rests.
  useEffect(() => {
    if (!heatmap || heatmap.key !== key || heatmap.tolerance === tolerance) return;
    let stale = false;
    const adopt = (next: CachedHeatmap): void => {
      cache.current = next;
      setHeatmap(next);
    };
    const timer = setTimeout(async () => {
      const rendered = await rerenderHeatmap(key, tolerance);
      if (stale) return;
      if (rendered) return adopt({ ...heatmap, ...rendered, tolerance });
      // The worker lost the pair (it restarted after a crash): compared again.
      setComparing(true);
      const compared = await compareImages(key, rasterize(oldImage), rasterize(newImage), anchor, tolerance);
      if (stale) return;
      adopt({ key, tolerance, ...compared });
      setComparing(false);
    }, TOLERANCE_PAUSE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [heatmap, key, tolerance, oldImage, newImage, anchor, cache]);

  return { heatmap: heatmap?.key === key ? heatmap : null, comparing };
}
