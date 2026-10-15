import { fakeApi } from '../../../../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundFile } from '@shared/domain/unityAssets';
import type { TextureDecodeRequest, TextureDecoded } from './decodeTexture';
import type { TextureLoad } from './textureLoads';

/** The worker, answering each decode when the test says: what it was handed, in order, and a wait for the next. */
const worker = vi.hoisted(() => {
  const state = {
    asked: [] as { name: string; answer: (decoded: TextureDecoded) => void }[],
    waiting: [] as { count: number; resolve: () => void }[],
    /** Resolves once the worker was handed `count` decodes in all. */
    whenAsked(count: number): Promise<void> {
      return new Promise((resolve) => (state.asked.length >= count ? resolve() : state.waiting.push({ count, resolve })));
    },
  };
  return state;
});
vi.mock('./textureWorkerSession', () => ({
  decodeOffThread: (request: TextureDecodeRequest) =>
    new Promise<TextureDecoded>((answer) => {
      worker.asked.push({ name: request.name, answer });
      worker.waiting.filter(({ count }) => worker.asked.length >= count).forEach(({ resolve }) => resolve());
    }),
}));

const WORKSPACE = '/work/models';
const revision = (name: string, revisionId: number): FoundFile => ({ path: `Art/${name}`, size: 10, stored: 'repository', revision: { revisionId, repository: 'models@local' }, hash: null });
const onDisk = (name: string): FoundFile => ({ path: `Art/${name}`, size: 10, stored: 'disk', modified: 1 });
const loadOf = (file: FoundFile, flipY = true): TextureLoad => ({ key: `${file.path}:${flipY}`, name: file.path.split('/').pop()!, source: { kind: 'found', file }, longest: 1024, flipY });
const FAILED: TextureDecoded = { kind: 'failed', problem: 'unsupportedFormat' };

describe('loadTextures', () => {
  beforeEach(() => {
    worker.asked = [];
    worker.waiting = [];
    vi.resetModules();
    fakeApi.answer('unityAssets.download', async () => undefined);
    fakeApi.answer('unityAssets.read', async () => new Uint8Array([1]));
  });
  afterEach(() => vi.useRealTimers());

  it("asks for every repository file's download at once, each once, then reads and decodes a few at a time", async () => {
    const { loadTextures, TEXTURES_IN_HAND } = await import('./textureLoads');
    const [bark, leaves, moss, stone] = [revision('bark.png', 1), revision('leaves.png', 2), revision('moss.png', 3), onDisk('stone.png')];
    const loads = [loadOf(bark!), loadOf(bark!, false), loadOf(leaves!), loadOf(moss!), loadOf(stone!)];

    const decoded = loadTextures(WORKSPACE, loads);
    await worker.whenAsked(TEXTURES_IN_HAND);

    expect(fakeApi.argsOf('unityAssets.download')).toEqual([[WORKSPACE, [bark, leaves, moss]]]);
    expect(fakeApi.argsOf('unityAssets.read')).toHaveLength(TEXTURES_IN_HAND);
    worker.asked[0]!.answer(FAILED);
    expect(await decoded[0]).toEqual(FAILED);
    await worker.whenAsked(TEXTURES_IN_HAND + 1);
    expect(fakeApi.argsOf('unityAssets.read')).toHaveLength(TEXTURES_IN_HAND + 1);
  });

  it('downloads nothing for textures decoded before, nor for files on the disk', async () => {
    const { loadTextures } = await import('./textureLoads');
    const bark = loadOf(revision('bark.png', 1));
    const [first] = loadTextures(WORKSPACE, [bark]);
    await worker.whenAsked(1);
    worker.asked[0]!.answer(FAILED);
    await first;

    loadTextures(WORKSPACE, [bark, loadOf(onDisk('stone.png'))]);
    await worker.whenAsked(2);

    expect(fakeApi.argsOf('unityAssets.download')).toHaveLength(1);
    expect(fakeApi.argsOf('unityAssets.read')).toHaveLength(2);
  });

  it('reads nothing for a texture still waiting its turn once no viewer wants it anymore', async () => {
    vi.useFakeTimers();
    const { holdTextures, loadTextures, TEXTURES_IN_HAND } = await import('./textureLoads');
    const loads = ['a.png', 'b.png', 'c.png', 'd.png'].map((name) => loadOf(onDisk(name)));
    const release = holdTextures(loads.map((load) => load.key));
    const decoded = loadTextures(WORKSPACE, loads);
    await worker.whenAsked(TEXTURES_IN_HAND);

    // The viewer goes, and the decodes are let go of a while later.
    release();
    await vi.runAllTimersAsync();
    worker.asked[0]!.answer(FAILED);
    const first = await Promise.race([decoded[3]!.then(() => 'let go of'), worker.whenAsked(TEXTURES_IN_HAND + 1).then(() => 'decoded')]);

    expect(first).toBe('let go of');
    expect(fakeApi.argsOf('unityAssets.read')).toHaveLength(TEXTURES_IN_HAND);
  });
});
