// The client of the image decoding worker, for the Materials look's textures (`decodeOffThread`) and for the images the
// browser can't decode (`paintOffThread`): one worker for the app's life, one queue for both. At most two requests
// are in the worker's hands at a time, the rest waiting here: this bounds the bytes handed to it, each request holding
// its file's bytes until the worker is done with it (two may be under way at once: a texture's decode awaits
// `createImageBitmap`, and the worker takes the next request meanwhile). An image asked to paint again while it is in
// hand is asked once (a viewer mounted twice by StrictMode, a merge's card and its diff), and one every viewer let go
// of (`release`) before its turn is never handed to the worker: stepping through a changeset's textures queues only
// the one on screen. Where the worker can't start, or dies, textures don't show and images fail: they are never decoded
// on the UI thread, which a large one would hold for seconds.

import { concurrencyLimit } from '@shared/concurrencyLimit';
import type { ImageBytes } from '@shared/domain/content';
import type { PaintableImage } from '../image/paintableImage';
import type { TextureDecodeRequest, TextureDecoded } from '../model/textures/decodeTexture';
import type { ImageDecodingRequest, ImageDecodingResponse } from './imageDecoding.worker';

const limited = concurrencyLimit(2);

// Undefined until first asked for; null once it couldn't start or died.
let worker: Worker | null | undefined;
let lastRequestId = 0;
const awaited = new Map<number, { resolve: (response: ImageDecodingResponse) => void; fail: () => void }>();
/** A paint in hand, and how many viewers still ask for it. */
interface Painting {
  askers: number;
  painted: Promise<PaintableImage>;
}
const painting = new WeakMap<ImageBytes, Painting>();

const FAILED_DECODE: TextureDecoded = { kind: 'failed', problem: 'unreadable' };
const FAILED_PAINT: PaintableImage = { status: 'failed', problem: 'unreadable' };
/** What a paint nobody waits for anymore resolves with: never shown. */
const UNASKED: PaintableImage = FAILED_PAINT;

/** The texture decoded in the worker; its bytes are handed over (transferred), not copied. */
export function decodeOffThread(request: TextureDecodeRequest): Promise<TextureDecoded> {
  return limited(async () => {
    const response = await ask((id) => ({ id, decode: request }), [request.bytes.buffer as ArrayBuffer]);
    return response && 'decoded' in response ? response.decoded : FAILED_DECODE;
  });
}

/** A paint asked for: what it gives, and `release` for the asker that no longer shows it (an effect's cleanup). */
export interface PaintRequest {
  painted: Promise<PaintableImage>;
  release(): void;
}

/** The image made paintable in the worker (`paintableImage`). Its bytes are copied there: the content cache keeps them. */
export function paintOffThread(image: ImageBytes): PaintRequest {
  const known = painting.get(image);
  if (!known) return requestOf(startPainting(image));
  known.askers++;
  return requestOf(known);
}

function requestOf(entry: Painting): PaintRequest {
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    entry.askers--;
  };
  return { painted: entry.painted, release };
}

function startPainting(image: ImageBytes): Painting {
  // Its first asker counts before the task can start, which it may at once.
  const entry: Painting = { askers: 1, painted: Promise.resolve(UNASKED) };
  entry.painted = limited(async () => {
    // Every asker let go while it waited: nobody shows it, so the worker never gets it. A new asker starts over.
    if (entry.askers === 0) {
      forget(image, entry);
      return UNASKED;
    }
    const response = await ask((id) => ({ id, paint: image }), []);
    return response && 'painted' in response ? response.painted : FAILED_PAINT;
  }).finally(() => forget(image, entry));
  painting.set(image, entry);
  return entry;
}

function forget(image: ImageBytes, entry: Painting): void {
  if (painting.get(image) === entry) painting.delete(image);
}

/** The worker's answer, or null when it can't start or dies first. */
function ask(request: (id: number) => ImageDecodingRequest, transfer: Transferable[]): Promise<ImageDecodingResponse | null> {
  const textureWorker = startedWorker();
  if (!textureWorker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = ++lastRequestId;
    awaited.set(id, { resolve, fail: () => resolve(null) });
    textureWorker.postMessage(request(id), transfer);
  });
}

function startedWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./imageDecoding.worker.ts', import.meta.url), { type: 'module', name: 'Image decoding' });
    worker.onmessage = ({ data: response }: MessageEvent<ImageDecodingResponse>) => {
      awaited.get(response.id)?.resolve(response);
      awaited.delete(response.id);
    };
    // The worker failed to load or crashed: what it was asked fails, and so does all that follows.
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      for (const request of awaited.values()) request.fail();
      awaited.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}
