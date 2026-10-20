import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageBytes } from '@shared/domain/content';
import type { ImageDecodingRequest, ImageDecodingResponse } from './imageDecoding.worker';

/** A worker that answers when the test says: it records what it was asked, and can crash. */
class FakeWorker {
  static created: FakeWorker[] = [];
  onmessage: ((event: { data: ImageDecodingResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly asked: ImageDecodingRequest[] = [];
  terminated = false;
  /** Resolved with each request as it arrives, so a test awaits the request rather than a number of microtasks. */
  private arrivals: ((request: ImageDecodingRequest) => void)[] = [];

  constructor() {
    FakeWorker.created.push(this);
  }

  postMessage(request: ImageDecodingRequest): void {
    this.asked.push(request);
    this.arrivals.shift()?.(request);
  }

  /** The next request, once the session sends it. */
  nextRequest(): Promise<ImageDecodingRequest> {
    return new Promise((resolve) => this.arrivals.push(resolve));
  }

  terminate(): void {
    this.terminated = true;
  }

  answer(request: ImageDecodingRequest): void {
    const data: ImageDecodingResponse =
      'decode' in request ? { id: request.id, decoded: { kind: 'failed', problem: 'tooLarge' } } : { id: request.id, painted: { status: 'failed', problem: 'psdColorMode' } };
    this.onmessage?.({ data });
  }
}

const request = (name: string) => ({ bytes: new Uint8Array([1, 2, 3]), name, longest: 2048, flipY: true });
const tga = (byte: number): ImageBytes => ({ bytes: new Uint8Array([byte]), mimeType: 'image/x-tga' });
const nameOf = (asked: ImageDecodingRequest): string => ('decode' in asked ? asked.decode.name : 'paint');

describe('imageDecodingSession', () => {
  beforeEach(() => {
    FakeWorker.created = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  /** The session with its worker started by a first decode, which the test gets to answer. */
  async function startedSession() {
    const session = await import('./imageDecodingSession');
    const first = session.decodeOffThread(request('first.png'));
    const [worker] = FakeWorker.created;
    return { session, worker: worker!, first };
  }

  it('hands the one worker two requests at a time, the next once one is answered', async () => {
    const { session, worker, first } = await startedSession();
    const second = worker.nextRequest();
    const painted = session.paintOffThread(tga(1));
    const third = session.decodeOffThread(request('c.png'));
    const paint = await second;
    expect(FakeWorker.created).toHaveLength(1);
    expect(worker.asked.map(nameOf)).toEqual(['first.png', 'paint']);
    const next = worker.nextRequest();
    worker.answer(paint);
    expect(await painted).toEqual({ status: 'failed', problem: 'psdColorMode' });
    worker.answer(await next);
    worker.answer(worker.asked[0]!);
    expect(await first).toEqual({ kind: 'failed', problem: 'tooLarge' });
    expect(await third).toEqual({ kind: 'failed', problem: 'tooLarge' });
    expect(worker.asked.map(nameOf)).toEqual(['first.png', 'paint', 'c.png']);
  });

  it('paints an image asked for again while it is in hand once, and again once it is done', async () => {
    const { session, worker } = await startedSession();
    const image = tga(1);
    const arrived = worker.nextRequest();
    const [one, two] = [session.paintOffThread(image), session.paintOffThread(image)];
    worker.answer(await arrived);
    expect(await one).toBe(await two);
    expect(worker.asked.filter((asked) => 'paint' in asked)).toHaveLength(1);
    const again = worker.nextRequest();
    void session.paintOffThread(image);
    expect(await again).toMatchObject({ paint: image });
  });

  it("fails what a crashed worker was asked, and what follows, and never decodes on the page's own thread", async () => {
    const { session, worker, first } = await startedSession();
    worker.onerror?.();
    expect(await first).toEqual({ kind: 'failed', problem: 'unreadable' });
    expect(await session.decodeOffThread(request('b.png'))).toEqual({ kind: 'failed', problem: 'unreadable' });
    expect(await session.paintOffThread(tga(2))).toEqual({ status: 'failed', problem: 'unreadable' });
    expect(FakeWorker.created).toHaveLength(1);
    expect(worker.terminated).toBe(true);
  });
});
