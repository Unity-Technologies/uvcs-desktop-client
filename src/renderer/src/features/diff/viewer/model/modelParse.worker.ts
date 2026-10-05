// Parses a model's bytes and sums it up (`readModelFile`) off the UI thread: a 50 MB FBX takes over a second that
// must never hold a paint. The parsed arrays cross back transferred, not copied. This file is only the messaging.

import type { ModelBytes } from '@shared/domain/content';
import { readModelFile, type ModelFileRead } from './readModelFile';
import { transferablesOf } from './parsedModel';

export interface ModelWorkerRequest {
  id: number;
  model: ModelBytes;
}

export type ModelWorkerResponse = { id: number } & ModelFileRead;

// The renderer's tsconfig types the DOM, not lib.webworker: the worker's global with just what this file uses.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ModelWorkerRequest>) => void) | null;
  postMessage(message: ModelWorkerResponse, transfer?: Transferable[]): void;
};

scope.onmessage = async ({ data: request }) => {
  const read = await readModelFile(request.model);
  scope.postMessage({ id: request.id, ...read }, read.kind === 'read' ? transferablesOf(read.model) : []);
};
