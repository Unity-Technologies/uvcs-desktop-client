// The model diff's work off the UI thread: reading a model (`readModelFile`: a 50 MB FBX takes over a second that
// must never hold a paint) and comparing two versions' surfaces (`compareSurfaces`: seconds for millions of vertices).
// What crosses back is transferred, not copied. This file is only the messaging.

import type { ModelBytes } from '@shared/domain/content';
import { transferablesOf } from './parsedModel';
import { readModelFile, type ModelFileRead } from './readModelFile';
import { compareSurfaces, placedMeshesOf, type PlaceableModel, type SurfaceComparison } from './surfaceComparison';

export type ModelWorkerRequest = { id: number; read: ModelBytes } | { id: number; compare: { before: PlaceableModel; after: PlaceableModel } };

export type ModelWorkerResponse = { id: number; read: ModelFileRead } | { id: number; comparison: SurfaceComparison };

// The renderer's tsconfig types the DOM, not lib.webworker: the worker's global with just what this file uses.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ModelWorkerRequest>) => void) | null;
  postMessage(message: ModelWorkerResponse, transfer?: Transferable[]): void;
};

scope.onmessage = async ({ data: request }) => {
  if ('read' in request) {
    const read = await readModelFile(request.read);
    scope.postMessage({ id: request.id, read }, read.kind === 'read' ? transferablesOf(read.model) : []);
    return;
  }
  const comparison = compareSurfaces(placedMeshesOf(request.compare.before), placedMeshesOf(request.compare.after));
  scope.postMessage({ id: request.id, comparison }, [...comparison.before, ...comparison.after].map((distances) => distances.buffer as ArrayBuffer));
};
