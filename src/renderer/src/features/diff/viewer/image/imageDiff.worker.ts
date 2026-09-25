// The image-diff pixel passes (perceptual compare, heatmap render, region
// clustering) run here, off the UI thread — a 4K pair takes tens of
// milliseconds that must never block a paint. The worker holds the last
// computed DiffData keyed by the request `key`, so moving the tolerance
// slider is a render-only round trip: no pixels are re-compared. All logic
// lives in imageDiff.ts (pure, unit-tested); this file is only the wiring.

import {
  type AnchorMode,
  type ChangedRegion,
  computeDiff,
  type DiffData,
  findChangedRegions,
  type RgbaBitmap,
  renderDiffFrame,
} from './imageDiff';

/** A bitmap flattened for postMessage (structured clone keeps it intact). */
export interface BitmapPayload {
  data: ArrayBuffer;
  width: number;
  height: number;
}

export type DiffWorkerRequest =
  | {
      id: number;
      kind: 'compute';
      key: string;
      old: BitmapPayload;
      new: BitmapPayload;
      anchor: AnchorMode;
      threshold: number;
    }
  | { id: number; kind: 'rethreshold'; key: string; threshold: number };

export type DiffWorkerResponse =
  | {
      id: number;
      kind: 'computed';
      frame: ArrayBuffer;
      width: number;
      height: number;
      regions: ChangedRegion[];
      coveredPixels: number;
      histogram: ArrayBuffer;
    }
  | {
      id: number;
      kind: 'rendered';
      frame: ArrayBuffer;
      width: number;
      height: number;
      regions: ChangedRegion[];
    }
  /** The worker no longer holds that key — the caller must recompute. */
  | { id: number; kind: 'gone' };

// The renderer tsconfig targets the DOM, not lib.webworker; type the worker
// global with just the two members this file touches.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<DiffWorkerRequest>) => void) | null;
  postMessage(message: DiffWorkerResponse, transfer?: Transferable[]): void;
};

/** The last computed pair: rethreshold requests re-render from this. */
let held: { key: string; data: DiffData } | null = null;

const toBitmap = (p: BitmapPayload): RgbaBitmap => ({
  data: new Uint8ClampedArray(p.data),
  width: p.width,
  height: p.height,
});

function frameAndRegions(
  data: DiffData,
  threshold: number,
): { frame: ArrayBuffer; width: number; height: number; regions: ChangedRegion[] } {
  return {
    frame: renderDiffFrame(data, threshold).buffer,
    width: data.width,
    height: data.height,
    regions: findChangedRegions(data.delta, data.width, data.height, threshold),
  };
}

scope.onmessage = (e) => {
  const req = e.data;
  if (req.kind === 'compute') {
    const data = computeDiff(toBitmap(req.old), toBitmap(req.new), req.anchor);
    held = { key: req.key, data };
    const payload = frameAndRegions(data, req.threshold);
    // The histogram transfers out (the renderer thresholds with it); delta and
    // underlay stay here for rethreshold renders.
    scope.postMessage(
      {
        id: req.id,
        kind: 'computed',
        coveredPixels: data.coveredPixels,
        histogram: data.histogram.buffer,
        ...payload,
      },
      [payload.frame, data.histogram.buffer],
    );
    return;
  }
  if (!held || held.key !== req.key) {
    scope.postMessage({ id: req.id, kind: 'gone' });
    return;
  }
  const payload = frameAndRegions(held.data, req.threshold);
  scope.postMessage({ id: req.id, kind: 'rendered', ...payload }, [payload.frame]);
};
