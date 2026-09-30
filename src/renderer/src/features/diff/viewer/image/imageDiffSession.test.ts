import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RgbaBitmap } from './pixelComparison';
import type { DiffWorkerRequest, DiffWorkerResponse } from './imageDiff.worker';

/**
 * The image diff's client (`imageDiffSession`): the worker does the pixel passes, and when it can't start or dies
 * mid-flight the same passes run on the main thread, slower but never wrong. The session keeps one worker for the
 * app's life, so each test loads it anew.
 */

class FakeImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}

/** A worker that answers by `respond`, or crashes when it answers null. */
class FakeWorker {
  static respond: (request: DiffWorkerRequest) => DiffWorkerResponse | null = () => null;
  static started = 0;
  onmessage: ((event: { data: DiffWorkerResponse }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeWorker.started++;
  }

  postMessage(request: DiffWorkerRequest): void {
    const response = FakeWorker.respond(request);
    queueMicrotask(() => (response ? this.onmessage?.({ data: response }) : this.onerror?.()));
  }

  terminate(): void {}
}

const pixels = (...values: number[][]): RgbaBitmap => ({ data: new Uint8ClampedArray(values.flat()), width: values.length, height: 1 });
const OLD = pixels([0, 0, 0, 255], [10, 10, 10, 255]);
const NEW = pixels([0, 0, 0, 255], [250, 250, 250, 255]);

async function loadSession(worker: typeof FakeWorker | undefined) {
  vi.resetModules();
  vi.stubGlobal('ImageData', FakeImageData);
  vi.stubGlobal('Worker', worker);
  return import('./imageDiffSession');
}

beforeEach(() => {
  FakeWorker.started = 0;
  FakeWorker.respond = () => null;
});
afterEach(() => vi.unstubAllGlobals());

describe('without a worker', () => {
  it('compares on the main thread, finding the changed pixel', async () => {
    const session = await loadSession(undefined);
    const diff = await session.compareImages('pair', OLD, NEW, 'center', 0);
    expect(diff.coveredPixels).toBe(2);
    expect(diff.regions.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([{ x: 1, y: 0, width: 1, height: 1 }]);
    expect(diff.imageData).toMatchObject({ width: 2, height: 1 });
  });

  it('renders a new tolerance from the pair it holds, and nothing for another pair', async () => {
    const session = await loadSession(undefined);
    await session.compareImages('pair', OLD, NEW, 'center', 0);
    expect((await session.rerenderHeatmap('pair', 255))?.regions).toEqual([]);
    expect(await session.rerenderHeatmap('another pair', 0)).toBeNull();
  });
});

describe('with a worker', () => {
  it("takes the worker's frame and regions", async () => {
    FakeWorker.respond = (request) => ({
      id: request.id,
      kind: 'compared',
      pixels: new Uint8ClampedArray(8).buffer,
      width: 2,
      height: 1,
      regions: [{ x: 1, y: 0, width: 1, height: 1, pixels: 1 }],
      coveredPixels: 2,
      histogram: new Uint32Array(256).buffer,
    });
    const session = await loadSession(FakeWorker);
    const diff = await session.compareImages('pair', OLD, NEW, 'center', 0);
    expect(diff.regions).toEqual([{ x: 1, y: 0, width: 1, height: 1, pixels: 1 }]);
  });

  it('computes again when the worker no longer holds the pair', async () => {
    FakeWorker.respond = (request) => ({ id: request.id, kind: 'gone' });
    const session = await loadSession(FakeWorker);
    expect(await session.rerenderHeatmap('pair', 10)).toBeNull();
  });

  it('falls back to the main thread when the worker dies mid-flight, and never starts another', async () => {
    const session = await loadSession(FakeWorker);
    const fallback = await session.compareImages('pair', OLD, NEW, 'center', 0);
    expect(fallback.regions.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([{ x: 1, y: 0, width: 1, height: 1 }]);
    expect(fallback.coveredPixels).toBe(2);
    await session.compareImages('pair', OLD, NEW, 'center', 0);
    expect(FakeWorker.started).toBe(1);
    expect((await session.rerenderHeatmap('pair', 255))?.regions).toEqual([]);
  });
});
