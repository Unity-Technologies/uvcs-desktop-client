import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextureWorkerRequest, TextureWorkerResponse } from './texture.worker';

/** A worker that answers when the test says: it records what it was asked, and can crash. */
class FakeWorker {
  static created: FakeWorker[] = [];
  onmessage: ((event: { data: TextureWorkerResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly asked: TextureWorkerRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.created.push(this);
  }

  postMessage(request: TextureWorkerRequest): void {
    this.asked.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  answer(id: number): void {
    this.onmessage?.({ data: { id, decoded: { kind: 'failed', problem: 'tooLarge' } } });
  }
}

const request = (name: string) => ({ bytes: new Uint8Array([1, 2, 3]), name, longest: 2048, flipY: true });
/** Lets the session's promises run their course: no time passes. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('textureWorkerSession', () => {
  beforeEach(() => {
    FakeWorker.created = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks the one worker two textures at a time, the next once one is answered', async () => {
    const { decodeOffThread } = await import('./textureWorkerSession');
    const decodes = ['a.png', 'b.png', 'c.png'].map((name) => decodeOffThread(request(name)));
    await settle();
    const [worker] = FakeWorker.created;
    expect(FakeWorker.created).toHaveLength(1);
    expect(worker!.asked.map((asked) => asked.decode.name)).toEqual(['a.png', 'b.png']);
    worker!.answer(worker!.asked[0]!.id);
    expect(await decodes[0]).toEqual({ kind: 'failed', problem: 'tooLarge' });
    await settle();
    expect(worker!.asked.map((asked) => asked.decode.name)).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it("fails what a crashed worker was asked, and what follows, and never decodes on the page's own thread", async () => {
    const { decodeOffThread } = await import('./textureWorkerSession');
    const pending = decodeOffThread(request('a.png'));
    await settle();
    FakeWorker.created[0]!.onerror?.();
    expect(await pending).toEqual({ kind: 'failed', problem: 'unreadable' });
    expect(await decodeOffThread(request('b.png'))).toEqual({ kind: 'failed', problem: 'unreadable' });
    expect(FakeWorker.created).toHaveLength(1);
    expect(FakeWorker.created[0]!.terminated).toBe(true);
  });
});
