import { fakeApi } from '../../../../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundFile } from '@shared/domain/unityAssets';
import type { TextureDecodeRequest, TextureDecoded } from './decodeTexture';
import type { TextureLoad } from './textureLoads';

/** The worker, answering each decode when the test says: what it was handed, in order. */
const worker = vi.hoisted(() => ({ asked: [] as { name: string; answer: (decoded: TextureDecoded) => void }[] }));
vi.mock('./textureWorkerSession', () => ({
  decodeOffThread: (request: TextureDecodeRequest) => new Promise<TextureDecoded>((answer) => worker.asked.push({ name: request.name, answer })),
}));

const WORKSPACE = '/work/models';
const revision = (name: string, revisionId: number): FoundFile => ({ path: `Art/${name}`, size: 10, stored: 'repository', revision: { revisionId, repository: 'models@local' }, hash: null });
const onDisk = (name: string): FoundFile => ({ path: `Art/${name}`, size: 10, stored: 'disk', modified: 1 });
const loadOf = (file: FoundFile, flipY = true): TextureLoad => ({ key: `${file.path}:${flipY}`, name: file.path.split('/').pop()!, source: { kind: 'found', file }, longest: 1024, flipY });
const FAILED: TextureDecoded = { kind: 'failed', problem: 'unsupportedFormat' };
/** Lets the reads and decodes asked run their course: no time passes. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('loadTextures', () => {
  beforeEach(() => {
    worker.asked = [];
    vi.resetModules();
    fakeApi.answer('unityAssets.download', async () => undefined);
    fakeApi.answer('unityAssets.read', async () => new Uint8Array([1]));
  });

  it("asks for every repository file's download at once, each once, then reads and decodes a few at a time", async () => {
    const { loadTextures, TEXTURES_IN_HAND } = await import('./textureLoads');
    const [bark, leaves, moss, stone] = [revision('bark.png', 1), revision('leaves.png', 2), revision('moss.png', 3), onDisk('stone.png')];
    const loads = [loadOf(bark!), loadOf(bark!, false), loadOf(leaves!), loadOf(moss!), loadOf(stone!)];

    const decoded = loadTextures(WORKSPACE, loads);
    await settle();

    expect(fakeApi.argsOf('unityAssets.download')).toEqual([[WORKSPACE, [bark, leaves, moss]]]);
    expect(fakeApi.argsOf('unityAssets.read')).toHaveLength(TEXTURES_IN_HAND);
    worker.asked[0]!.answer(FAILED);
    await settle();
    expect(fakeApi.argsOf('unityAssets.read')).toHaveLength(TEXTURES_IN_HAND + 1);
    expect(await decoded[0]).toEqual(FAILED);
  });

  it('downloads nothing for textures decoded before, nor for files on the disk', async () => {
    const { loadTextures } = await import('./textureLoads');
    const bark = loadOf(revision('bark.png', 1));
    const first = loadTextures(WORKSPACE, [bark]);
    await settle();
    worker.asked[0]!.answer(FAILED);
    await first[0];

    loadTextures(WORKSPACE, [bark, loadOf(onDisk('stone.png'))]);
    await settle();

    expect(fakeApi.argsOf('unityAssets.download')).toHaveLength(1);
    expect(fakeApi.argsOf('unityAssets.read')).toHaveLength(2);
  });
});
