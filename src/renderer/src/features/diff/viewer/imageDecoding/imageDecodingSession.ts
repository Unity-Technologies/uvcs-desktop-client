// The client of the image decoding worker, for the Materials look's textures (`decodeOffThread`) and for the images the
// browser can't decode (`paintOffThread`): one worker for the app's life. At most two requests are in the worker at a
// time, the rest waiting here: the worker decodes one at a time, and this bounds the bytes handed to it, each request
// holding its file's bytes until the worker has decoded it. An image asked to paint again while it is in hand is
// asked once (a viewer mounted twice by StrictMode, a merge's card and its diff). Where the worker can't start, or
// dies, textures don't show and images fail: they are never decoded on the UI thread, which a large one would hold
// for seconds.

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
const painting = new WeakMap<ImageBytes, Promise<PaintableImage>>();

const FAILED_DECODE: TextureDecoded = { kind: 'failed', problem: 'unreadable' };
const FAILED_PAINT: PaintableImage = { status: 'failed', problem: 'unreadable' };

/** The texture decoded in the worker; its bytes are handed over (transferred), not copied. */
export function decodeOffThread(request: TextureDecodeRequest): Promise<TextureDecoded> {
  return limited(async () => {
    const response = await ask((id) => ({ id, decode: request }), [request.bytes.buffer as ArrayBuffer]);
    return response && 'decoded' in response ? response.decoded : FAILED_DECODE;
  });
}

/** The image made paintable in the worker (`paintableImage`). Its bytes are copied there: the content cache keeps them. */
export function paintOffThread(image: ImageBytes): Promise<PaintableImage> {
  const asked = painting.get(image);
  if (asked) return asked;
  const painted = limited(async () => {
    const response = await ask((id) => ({ id, paint: image }), []);
    return response && 'painted' in response ? response.painted : FAILED_PAINT;
  }).finally(() => painting.delete(image));
  painting.set(image, painted);
  return painted;
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
