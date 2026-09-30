// The Differences mode's client of the image diff worker. One worker for the app's life outlives mode switches and
// files, so coming back to Differences, or moving the tolerance, is a quick render against the pair it keeps. When
// the worker can't start or dies mid-flight, the same passes run on the main thread: slower, never wrong.

import type { ChangedRegion } from './changedRegions';
import { heatmapPasses, type RenderedHeatmap } from './heatmapPasses';
import type { AnchorMode } from './composedFrame';
import type { BitmapPayload, DiffWorkerRequest, DiffWorkerResponse, HeatmapPayload } from './imageDiff.worker';
import type { RgbaBitmap } from './pixelComparison';

/** A heatmap ready to paint, and the changed regions to step through, at one tolerance. */
export interface Heatmap {
  imageData: ImageData;
  regions: ChangedRegion[];
}

/** A pair compared: its heatmap, and what counts changed pixels at any tolerance (`countChangedPixels`). */
export interface ComparedImages extends Heatmap {
  coveredPixels: number;
  histogram: Uint32Array;
}

// Undefined until first asked for; null once it couldn't start or died: the main thread does the passes from then on.
let worker: Worker | null | undefined;
let lastRequestId = 0;
const awaited = new Map<number, { resolve: (response: DiffWorkerResponse) => void; reject: () => void }>();
const mainThreadPasses = heatmapPasses();

/** Compares a pair and renders its heatmap at `tolerance`. `key` (`compositionKey`) names the pair for `rerenderHeatmap`. */
export async function compareImages(key: string, old: RgbaBitmap, next: RgbaBitmap, anchor: AnchorMode, tolerance: number): Promise<ComparedImages> {
  const imageWorker = startedWorker();
  const response = imageWorker && (await ask(imageWorker, { id: ++lastRequestId, kind: 'compare', key, old: toPayload(old), new: toPayload(next), anchor, tolerance }));
  if (response?.kind === 'compared') return { ...toHeatmap(response), coveredPixels: response.coveredPixels, histogram: new Uint32Array(response.histogram) };
  const { coveredPixels, histogram, ...heatmap } = mainThreadPasses.compare(key, old, next, anchor, tolerance);
  return { ...paintable(heatmap), coveredPixels, histogram };
}

/** Renders the pair `key` names at another tolerance; null when it isn't kept anymore (a restarted worker): compare it again. */
export async function rerenderHeatmap(key: string, tolerance: number): Promise<Heatmap | null> {
  const imageWorker = startedWorker();
  if (!imageWorker) {
    const heatmap = mainThreadPasses.rerender(key, tolerance);
    return heatmap && paintable(heatmap);
  }
  const response = await ask(imageWorker, { id: ++lastRequestId, kind: 'rerender', key, tolerance });
  return response?.kind === 'rendered' ? toHeatmap(response) : null;
}

function startedWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./imageDiff.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data: response }: MessageEvent<DiffWorkerResponse>) => {
      awaited.get(response.id)?.resolve(response);
      awaited.delete(response.id);
    };
    // The worker failed to load or crashed: what it was asked fails over to the main thread, and so does all that follows.
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      for (const request of awaited.values()) request.reject();
      awaited.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** The worker's answer, or null when it died first. */
function ask(imageWorker: Worker, request: DiffWorkerRequest): Promise<DiffWorkerResponse | null> {
  return new Promise<DiffWorkerResponse>((resolve, reject) => {
    awaited.set(request.id, { resolve, reject });
    imageWorker.postMessage(request);
  }).catch(() => null);
}

function toPayload({ data, width, height }: RgbaBitmap): BitmapPayload {
  return { data: data.buffer, width, height };
}

function toHeatmap({ pixels, width, height, regions }: HeatmapPayload): Heatmap {
  return { imageData: new ImageData(new Uint8ClampedArray(pixels), width, height), regions };
}

function paintable({ pixels, width, height, regions }: RenderedHeatmap): Heatmap {
  return { imageData: new ImageData(pixels, width, height), regions };
}
