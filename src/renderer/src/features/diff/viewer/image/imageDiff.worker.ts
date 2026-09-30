// The Differences mode's pixel passes (`heatmapPasses`), off the UI thread: a 4K pair takes tens of milliseconds that
// must never hold a paint. The worker keeps the last pair compared, so moving the tolerance slider only renders the
// heatmap again. This file is only the messaging.

import type { ChangedRegion } from './changedRegions';
import { heatmapPasses, type RenderedHeatmap } from './heatmapPasses';
import type { AnchorMode } from './imageDiff';
import type { RgbaBitmap } from './pixelComparison';

/** A bitmap as it crosses to the worker (a structured clone keeps it whole). */
export interface BitmapPayload {
  data: ArrayBuffer;
  width: number;
  height: number;
}

export type DiffWorkerRequest =
  | { id: number; kind: 'compare'; key: string; old: BitmapPayload; new: BitmapPayload; anchor: AnchorMode; tolerance: number }
  | { id: number; kind: 'rerender'; key: string; tolerance: number };

/** A heatmap as it crosses back: its pixels' buffer is transferred, not copied. */
export interface HeatmapPayload {
  pixels: ArrayBuffer;
  width: number;
  height: number;
  regions: ChangedRegion[];
}

export type DiffWorkerResponse =
  | ({ id: number; kind: 'compared'; coveredPixels: number; histogram: ArrayBuffer } & HeatmapPayload)
  | ({ id: number; kind: 'rendered' } & HeatmapPayload)
  /** The worker no longer keeps that pair: compare it again. */
  | { id: number; kind: 'gone' };

// The renderer's tsconfig types the DOM, not lib.webworker: the worker's global with just what this file uses.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DiffWorkerRequest>) => void) | null;
  postMessage(message: DiffWorkerResponse, transfer?: Transferable[]): void;
};

const passes = heatmapPasses();

scope.onmessage = ({ data: request }) => {
  if (request.kind === 'compare') {
    const { coveredPixels, histogram, ...heatmap } = passes.compare(request.key, toBitmap(request.old), toBitmap(request.new), request.anchor, request.tolerance);
    // The histogram goes to the renderer, which counts changed pixels with it; the comparison stays for `rerender`.
    const payload = toPayload(heatmap);
    scope.postMessage({ id: request.id, kind: 'compared', coveredPixels, histogram: histogram.buffer, ...payload }, [payload.pixels, histogram.buffer]);
    return;
  }
  const heatmap = passes.rerender(request.key, request.tolerance);
  if (!heatmap) return scope.postMessage({ id: request.id, kind: 'gone' });
  const payload = toPayload(heatmap);
  scope.postMessage({ id: request.id, kind: 'rendered', ...payload }, [payload.pixels]);
};

function toBitmap(payload: BitmapPayload): RgbaBitmap {
  return { data: new Uint8ClampedArray(payload.data), width: payload.width, height: payload.height };
}

function toPayload({ pixels, width, height, regions }: RenderedHeatmap): HeatmapPayload {
  return { pixels: pixels.buffer, width, height, regions };
}
