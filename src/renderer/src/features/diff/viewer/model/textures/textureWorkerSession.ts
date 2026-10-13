// The Materials look's client of the texture worker: one worker for the app's life, a few decodes at a time (each one
// holds its image's every pixel while it decodes). Where the worker can't start, or dies, textures don't show: they
// are never decoded on the UI thread, which a large one would hold for seconds.

import { concurrencyLimit } from '@shared/concurrencyLimit';
import type { TextureDecodeRequest, TextureDecoded } from './decodeTexture';
import type { TextureWorkerRequest, TextureWorkerResponse } from './texture.worker';

const limited = concurrencyLimit(2);

// Undefined until first asked for; null once it couldn't start or died.
let worker: Worker | null | undefined;
let lastRequestId = 0;
const awaited = new Map<number, (decoded: TextureDecoded) => void>();

const FAILED: TextureDecoded = { kind: 'failed', problem: 'unreadable' };

/** The texture decoded in the worker; its bytes are handed over (transferred), not copied. */
export function decodeOffThread(request: TextureDecodeRequest): Promise<TextureDecoded> {
  return limited(async () => {
    const textureWorker = startedWorker();
    if (!textureWorker) return FAILED;
    return new Promise<TextureDecoded>((resolve) => {
      const id = ++lastRequestId;
      awaited.set(id, resolve);
      const message: TextureWorkerRequest = { id, decode: request };
      textureWorker.postMessage(message, [request.bytes.buffer as ArrayBuffer]);
    });
  });
}

function startedWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./texture.worker.ts', import.meta.url), { type: 'module', name: 'Textures' });
    worker.onmessage = ({ data: response }: MessageEvent<TextureWorkerResponse>) => {
      awaited.get(response.id)?.(response.decoded);
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
