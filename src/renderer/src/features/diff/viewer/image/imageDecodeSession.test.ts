import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageBytes } from '@shared/domain/content';
import type { ImageDecodeRequest, ImageDecodeResponse } from './imageDecode.worker';

/** A worker that answers when the test says: it records what it was asked, and can crash. */
class FakeWorker {
  static created: FakeWorker[] = [];
  onmessage: ((event: { data: ImageDecodeResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly asked: ImageDecodeRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.created.push(this);
  }

  postMessage(request: ImageDecodeRequest): void {
    this.asked.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  answer(id: number): void {
    this.onmessage?.({ data: { id, painted: { status: 'failed', problem: 'psdColorMode' } } });
  }
}

const tga = (byte: number): ImageBytes => ({ bytes: new Uint8Array([byte]), mimeType: 'image/x-tga' });
/** Lets the session's promises run their course: no time passes. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('imageDecodeSession', () => {
  beforeEach(() => {
    FakeWorker.created = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks the one worker two images at a time, the next once one is answered', async () => {
    const { paintableOffThread } = await import('./imageDecodeSession');
    const images = [tga(1), tga(2), tga(3)];
    const decodes = images.map(paintableOffThread);
    await settle();
    const [worker] = FakeWorker.created;
    expect(FakeWorker.created).toHaveLength(1);
    expect(worker!.asked.map((asked) => asked.image)).toEqual([images[0], images[1]]);
    worker!.answer(worker!.asked[0]!.id);
    expect(await decodes[0]).toEqual({ status: 'failed', problem: 'psdColorMode' });
    await settle();
    expect(worker!.asked.map((asked) => asked.image)).toEqual(images);
  });

  it('decodes an image asked for again while it decodes once, and again once it is done', async () => {
    const { paintableOffThread } = await import('./imageDecodeSession');
    const image = tga(1);
    const [first, second] = [paintableOffThread(image), paintableOffThread(image)];
    await settle();
    const [worker] = FakeWorker.created;
    expect(worker!.asked).toHaveLength(1);
    worker!.answer(worker!.asked[0]!.id);
    expect(await first).toBe(await second);
    void paintableOffThread(image);
    await settle();
    expect(worker!.asked).toHaveLength(2);
  });

  it("fails what a crashed worker was asked, and what follows, and never decodes on the page's own thread", async () => {
    const { paintableOffThread } = await import('./imageDecodeSession');
    const pending = paintableOffThread(tga(1));
    await settle();
    FakeWorker.created[0]!.onerror?.();
    expect(await pending).toEqual({ status: 'failed', problem: 'unreadable' });
    expect(await paintableOffThread(tga(2))).toEqual({ status: 'failed', problem: 'unreadable' });
    expect(FakeWorker.created).toHaveLength(1);
    expect(FakeWorker.created[0]!.terminated).toBe(true);
  });
});
