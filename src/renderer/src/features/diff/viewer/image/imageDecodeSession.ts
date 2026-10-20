// The client of the image decode worker, for whatever shows an image the browser can't decode (the image diff, the
// merge page's previews): one worker for the app's life, two decodes at a time (each holds its image's every pixel
// while it decodes, an EXR's as floats), and one decode per image asked for again while it runs (a viewer mounted
// twice by StrictMode, a merge's card and its diff). Where the worker can't start, or dies, the image fails: it is never
// decoded on the UI thread, which a large one would hold for seconds.

import { concurrencyLimit } from '@shared/concurrencyLimit';
import type { ImageBytes } from '@shared/domain/content';
import type { ImageDecodeRequest, ImageDecodeResponse } from './imageDecode.worker';
import type { PaintableImage } from './paintableImage';

const limited = concurrencyLimit(2);

// Undefined until first asked for; null once it couldn't start or died.
let worker: Worker | null | undefined;
let lastRequestId = 0;
const awaited = new Map<number, (painted: PaintableImage) => void>();
const running = new WeakMap<ImageBytes, Promise<PaintableImage>>();

const FAILED: PaintableImage = { status: 'failed', problem: 'unreadable' };

/** The image made paintable in the worker. Its bytes are copied there, not transferred: the content cache keeps them. */
export function paintableOffThread(image: ImageBytes): Promise<PaintableImage> {
  const asked = running.get(image);
  if (asked) return asked;
  const painted = limited(() => ask(image)).finally(() => running.delete(image));
  running.set(image, painted);
  return painted;
}

function ask(image: ImageBytes): Promise<PaintableImage> {
  const decodeWorker = startedWorker();
  if (!decodeWorker) return Promise.resolve(FAILED);
  return new Promise<PaintableImage>((resolve) => {
    const id = ++lastRequestId;
    awaited.set(id, resolve);
    decodeWorker.postMessage({ id, image } satisfies ImageDecodeRequest);
  });
}

function startedWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./imageDecode.worker.ts', import.meta.url), { type: 'module', name: 'Image decoding' });
    worker.onmessage = ({ data: response }: MessageEvent<ImageDecodeResponse>) => {
      awaited.get(response.id)?.(response.painted);
      awaited.delete(response.id);
    };
    // The worker failed to load or crashed: what it was asked fails, and so does all that follows.
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      for (const resolve of awaited.values()) resolve(FAILED);
      awaited.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}
