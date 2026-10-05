// The model diff's client of the model worker. One worker for the app's life: the next model doesn't pay for its
// start. When the worker can't start or dies mid-flight, the work is done on the main thread: slower, never wrong.
// Each version is read once while its bytes are kept (the diff's content cache holds them), and each pair compared
// once while both are kept, so going back to a model, or from one mode to another, shows it at once.

import type { ModelBytes } from '@shared/domain/content';
import type { ModelWorkerRequest, ModelWorkerResponse } from './model.worker';
import type { ParsedModel } from './parsedModel';
import { readModelFile, type ModelFileRead } from './readModelFile';
import { compareSurfaces, placedMeshesOf, type PlaceableModel, type SurfaceComparison } from './surfaceComparison';

// Undefined until first asked for; null once it couldn't start or died: the main thread reads from then on.
let worker: Worker | null | undefined;
let lastRequestId = 0;
const awaited = new Map<number, { resolve: (response: ModelWorkerResponse) => void; reject: () => void }>();
/** By the model's bytes: each read with the companions it was given (the same bytes' versions of its `.bin`). */
const reads = new WeakMap<Uint8Array, { companions: Readonly<Record<string, Uint8Array>>; read: Promise<ModelFileRead> }[]>();
const comparisons = new WeakMap<ParsedModel, WeakMap<ParsedModel, Promise<SurfaceComparison>>>();

/** The model read, with the files it needs beside it (`gltfCompanions`), from the one read of the same bytes if there was one. */
export function readModel(model: ModelBytes, companions: Readonly<Record<string, Uint8Array>> = {}): Promise<ModelFileRead> {
  const kept = reads.get(model.bytes) ?? [];
  const same = kept.find((entry) => sameCompanions(entry.companions, companions));
  if (same) return same.read;
  const read = readInWorker(model, companions);
  reads.set(model.bytes, [...kept, { companions, read }]);
  return read;
}

function sameCompanions(a: Readonly<Record<string, Uint8Array>>, b: Readonly<Record<string, Uint8Array>>): boolean {
  const names = Object.keys(a);
  return names.length === Object.keys(b).length && names.every((name) => a[name] === b[name]);
}

/** The surfaces of a pair compared, from the one comparison of the same pair if there was one. */
export function compareModels(before: ParsedModel, after: ParsedModel): Promise<SurfaceComparison> {
  let ofBefore = comparisons.get(before);
  if (!ofBefore) comparisons.set(before, (ofBefore = new WeakMap()));
  let comparison = ofBefore.get(after);
  if (!comparison) {
    comparison = compareInWorker(before, after);
    ofBefore.set(after, comparison);
  }
  return comparison;
}

async function readInWorker(model: ModelBytes, companions: Readonly<Record<string, Uint8Array>>): Promise<ModelFileRead> {
  const modelWorker = startedWorker();
  // The bytes are copied to the worker, never transferred: the content cache keeps them for the next time.
  const response = modelWorker && (await ask(modelWorker, { id: ++lastRequestId, read: model, companions: { ...companions } }));
  return response && 'read' in response ? response.read : readModelFile(model, companions);
}

async function compareInWorker(before: ParsedModel, after: ParsedModel): Promise<SurfaceComparison> {
  const modelWorker = startedWorker();
  // Only what placing the meshes takes is copied to the worker; the viewer keeps drawing from the models.
  const response = modelWorker && (await ask(modelWorker, { id: ++lastRequestId, compare: { before: placeable(before), after: placeable(after) } }));
  return response && 'comparison' in response ? response.comparison : compareSurfaces(placedMeshesOf(before), placedMeshesOf(after));
}

function placeable({ nodes, unitScale, axisConversion, meshes }: ParsedModel): PlaceableModel {
  return { nodes, unitScale, axisConversion, meshes: meshes.map(({ node, attributes, index }) => ({ node, attributes: { position: attributes.position }, index })) };
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
function ask(modelWorker: Worker, request: ModelWorkerRequest): Promise<ModelWorkerResponse | null> {
  return new Promise<ModelWorkerResponse>((resolve, reject) => {
    awaited.set(request.id, { resolve, reject });
    modelWorker.postMessage(request);
  }).catch(() => null);
}
