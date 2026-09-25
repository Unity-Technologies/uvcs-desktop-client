import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReviewStore } from './ReviewStore';

describe('ReviewStore', () => {
  let workspace: string;
  let root: string;
  let store: ReviewStore;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'review-wk-'));
    root = await mkdtemp(join(tmpdir(), 'review-root-'));
    store = new ReviewStore(root);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  const write = (path: string, content: string | Buffer) => writeFile(join(workspace, path), content);

  it('keeps a mark while the file is untouched', async () => {
    await write('a.ts', 'one');
    await store.mark(workspace, ['a.ts']);
    expect(await store.marks(workspace)).toEqual([{ path: 'a.ts', state: 'reviewed', hasSnapshot: true }]);
  });

  it('flips the mark when the contents change after the review', async () => {
    await write('a.ts', 'one');
    await store.mark(workspace, ['a.ts']);
    await write('a.ts', 'two, longer');
    expect((await store.marks(workspace))[0]?.state).toBe('changedSinceReview');
  });

  it('keeps the mark when the file is rewritten with the same contents', async () => {
    await write('a.ts', 'one');
    await store.mark(workspace, ['a.ts']);
    await utimes(join(workspace, 'a.ts'), new Date(), new Date(Date.now() + 5000));
    expect((await store.marks(workspace))[0]?.state).toBe('reviewed');
  });

  it('keeps a copy of the reviewed text to compare with later', async () => {
    await write('a.ts', 'one');
    await store.mark(workspace, ['a.ts']);
    await write('a.ts', 'two');
    expect((await store.readSnapshot(workspace, 'a.ts')).text).toBe('one');
  });

  it('keeps no copy of binary files', async () => {
    await write('b.bin', Buffer.from([1, 0, 2]));
    await store.mark(workspace, ['b.bin']);
    expect((await store.marks(workspace))[0]?.hasSnapshot).toBe(false);
    await expect(store.readSnapshot(workspace, 'b.bin')).rejects.toThrow();
  });

  it('marks a deleted file, and notices when it comes back', async () => {
    await store.mark(workspace, ['gone.ts']);
    expect((await store.marks(workspace))[0]?.state).toBe('reviewed');
    await write('gone.ts', 'back');
    expect((await store.marks(workspace))[0]?.state).toBe('changedSinceReview');
  });

  it('drops the marks and copies of paths no longer pending, and its folder with the last one', async () => {
    await write('a.ts', 'one');
    await write('b.ts', 'two');
    await store.mark(workspace, ['a.ts', 'b.ts']);
    await store.keepOnly(workspace, ['b.ts']);
    expect((await store.marks(workspace)).map((mark) => mark.path)).toEqual(['b.ts']);
    await store.unmark(workspace, ['b.ts']);
    expect(await readdir(root)).toEqual([]);
  });

  it('remembers marks across restarts', async () => {
    await write('a.ts', 'one');
    await store.mark(workspace, ['a.ts']);
    expect(await new ReviewStore(root).marks(workspace)).toEqual([{ path: 'a.ts', state: 'reviewed', hasSnapshot: true }]);
  });
});
