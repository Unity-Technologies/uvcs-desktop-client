// Promise client for the image-diff worker. One module-level worker survives
// mode switches and file selections, so returning to the Differences mode (or
// nudging the tolerance slider) is a quick render round trip against the
// worker's cached delta. If the worker can't start or dies mid-flight, the
// same pure passes run synchronously on the main thread — slower, never wrong.

import {
  type AnchorMode,
  type ChangedRegion,
  computeDiff,
  type DiffData,
  findChangedRegions,
  type RgbaBitmap,
  renderDiffFrame,
} from './imageDiff';
import type { BitmapPayload, DiffWorkerRequest, DiffWorkerResponse } from './imageDiff.worker';

/** A rendered heatmap frame plus its navigable regions, at one tolerance. */
export interface DiffFrame {
  imageData: ImageData;
  regions: ChangedRegion[];
}

/** A full computation: the frame plus the threshold-independent measurements
 *  (the histogram makes per-tolerance stats an O(256) renderer-side sum). */
export interface DiffComputation extends DiffFrame {
  coveredPixels: number;
  histogram: Uint32Array;
}

// undefined = not tried yet, null = unavailable (fall back to sync).
let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, { resolve: (r: DiffWorkerResponse) => void; reject: () => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./imageDiff.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<DiffWorkerResponse>) => {
      const entry = pending.get(e.data.id);
      pending.delete(e.data.id);
      entry?.resolve(e.data);
    };
    worker.onerror = () => {
      // The worker is gone (failed to load or crashed): fail the in-flight
      // requests so their callers fall back to the synchronous path, and
      // never try the worker again this session.
      worker?.terminate();
      worker = null;
      for (const entry of pending.values()) entry.reject();
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

function request(req: DiffWorkerRequest, w: Worker): Promise<DiffWorkerResponse | null> {
  return new Promise<DiffWorkerResponse>((resolve, reject) => {
    pending.set(req.id, { resolve, reject });
    w.postMessage(req);
  }).catch(() => null);
}

// ── Synchronous fallback ─────────────────────────────────────────────────────
// Mirrors the worker's single-entry state so rethreshold works either way.

let syncHeld: { key: string; data: DiffData } | null = null;

function syncFrame(data: DiffData, threshold: number): DiffFrame {
  return {
    imageData: new ImageData(renderDiffFrame(data, threshold), data.width, data.height),
    regions: findChangedRegions(data.delta, data.width, data.height, threshold),
  };
}

function syncCompute(key: string, oldBitmap: RgbaBitmap, newBitmap: RgbaBitmap, anchor: AnchorMode, threshold: number): DiffComputation {
  const data = computeDiff(oldBitmap, newBitmap, anchor);
  syncHeld = { key, data };
  return {
    ...syncFrame(data, threshold),
    coveredPixels: data.coveredPixels,
    histogram: data.histogram,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

const payload = (b: RgbaBitmap): BitmapPayload => ({
  data: b.data.buffer,
  width: b.width,
  height: b.height,
});

/** Compare a pair and render its heatmap at `threshold`. `key` identifies the
 *  pair + anchor so later rethreshold calls can hit the cached delta. */
export async function computeImageDiff(
  key: string,
  oldBitmap: RgbaBitmap,
  newBitmap: RgbaBitmap,
  anchor: AnchorMode,
  threshold: number,
): Promise<DiffComputation> {
  const w = getWorker();
  if (!w) return syncCompute(key, oldBitmap, newBitmap, anchor, threshold);
  const res = await request(
    {
      id: ++seq,
      kind: 'compute',
      key,
      old: payload(oldBitmap),
      new: payload(newBitmap),
      anchor,
      threshold,
    },
    w,
  );
  if (res?.kind !== 'computed') {
    return syncCompute(key, oldBitmap, newBitmap, anchor, threshold);
  }
  return {
    imageData: new ImageData(new Uint8ClampedArray(res.frame), res.width, res.height),
    regions: res.regions,
    coveredPixels: res.coveredPixels,
    histogram: new Uint32Array(res.histogram),
  };
}

/** Re-render the heatmap for an already-computed pair at a new tolerance.
 *  Returns null when the delta for `key` is no longer held anywhere — the
 *  caller recomputes via computeImageDiff. */
export async function rethresholdImageDiff(key: string, threshold: number): Promise<DiffFrame | null> {
  const w = getWorker();
  if (!w) {
    if (!syncHeld || syncHeld.key !== key) return null;
    return syncFrame(syncHeld.data, threshold);
  }
  const res = await request({ id: ++seq, kind: 'rethreshold', key, threshold }, w);
  if (!res || res.kind === 'gone') return null;
  if (res.kind !== 'rendered') return null;
  return {
    imageData: new ImageData(new Uint8ClampedArray(res.frame), res.width, res.height),
    regions: res.regions,
  };
}
