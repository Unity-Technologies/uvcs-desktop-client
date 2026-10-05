// The model diff's client of the model worker. One worker for the app's life: the next model doesn't pay for its
// start. When the worker can't start or dies mid-flight, the model is read on the main thread: slower, never wrong.
// Each version is read once while its bytes are kept (the diff's content cache holds them), so going back to a model,
// or from one mode to another, shows it at once.

import type { ModelBytes } from '@shared/domain/content';
import type { ModelWorkerRequest, ModelWorkerResponse } from './model.worker';
import { readModelFile, type ModelFileRead } from './readModelFile';

// Undefined until first asked for; null once it couldn't start or died: the main thread reads from then on.
let worker: Worker | null | undefined;
let lastRequestId = 0;
const awaited = new Map<number, { resolve: (response: ModelWorkerResponse) => void; reject: () => void }>();
const reads = new WeakMap<Uint8Array, Promise<ModelFileRead>>();

/** The model read, from the one read of the same bytes if there was one. */
export function readModel(model: ModelBytes): Promise<ModelFileRead> {
  let read = reads.get(model.bytes);
  if (!read) {
    read = readInWorker(model);
    reads.set(model.bytes, read);
  }
  return read;
}

async function readInWorker(model: ModelBytes): Promise<ModelFileRead> {
  const parsingWorker = startedWorker();
  // The bytes are copied to the worker, never transferred: the content cache keeps them for the next time.
  const response = parsingWorker && (await ask(parsingWorker, { id: ++lastRequestId, model }));
  if (!response) return readModelFile(model);
  const { id: _id, ...read } = response;
  return read;
}

function startedWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module', name: 'Models' });
    worker.onmessage = ({ data: response }: MessageEvent<ModelWorkerResponse>) => {
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
function ask(parsingWorker: Worker, request: ModelWorkerRequest): Promise<ModelWorkerResponse | null> {
  return new Promise<ModelWorkerResponse>((resolve, reject) => {
    awaited.set(request.id, { resolve, reject });
    parsingWorker.postMessage(request);
  }).catch(() => null);
}
