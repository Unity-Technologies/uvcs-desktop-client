import { mkdtemp, readdir, rename, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseWorkspaceGuid, type WorkspaceGuid } from '@shared/domain/stableIds';
import { WORKSPACE_GUID } from '../cm/testing/cmOutput';
import { ReviewStore } from './ReviewStore';

const GUID = parseWorkspaceGuid(WORKSPACE_GUID) as WorkspaceGuid;

/** The workspace's GUID as `cm getworkspacefrompath` prints it, wherever its folder is. */
const knownGuid = async (): Promise<WorkspaceGuid | undefined> => GUID;

describe('ReviewStore', () => {
  let workspace: string;
  let root: string;
  let store: ReviewStore;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'review-wk-'));
    root = await mkdtemp(join(tmpdir(), 'review-root-'));
    store = new ReviewStore(root, knownGuid);
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
    expect(await new ReviewStore(root, knownGuid).marks(workspace)).toEqual([{ path: 'a.ts', state: 'reviewed', hasSnapshot: true }]);
  });

  it('keeps the marks of a workspace moved or renamed: they are kept by its GUID, not its folder', async () => {
    await write('a.ts', 'one');
    await store.mark(workspace, ['a.ts']);
    const moved = `${workspace}-moved`;
    await rename(workspace, moved);
    workspace = moved;

    expect(await new ReviewStore(root, knownGuid).marks(moved)).toEqual([{ path: 'a.ts', state: 'reviewed', hasSnapshot: true }]);
    expect(await readdir(root)).toEqual([GUID]);
  });

  it("moves the marks kept by the workspace's path to its GUID the first time they're read", async () => {
    await write('a.ts', 'one');
    // A `cm` that prints no GUID keeps them by the path, as every version did before.
    await new ReviewStore(root, async () => undefined).mark(workspace, ['a.ts']);
    const [byPath] = await readdir(root);
    expect(byPath).not.toBe(GUID);

    const byGuid = new ReviewStore(root, knownGuid);
    expect(await byGuid.marks(workspace)).toEqual([{ path: 'a.ts', state: 'reviewed', hasSnapshot: true }]);
    expect(await readdir(root)).toEqual([GUID]);
    await write('a.ts', 'two');
    expect((await byGuid.readSnapshot(workspace, 'a.ts')).text).toBe('one');
  });

  it("drops the folder kept by the path once the GUID's has the marks", async () => {
    await write('a.ts', 'one');
    await store.mark(workspace, ['a.ts']);
    // A `cm` that printed no GUID meanwhile left a folder by the path.
    await new ReviewStore(root, async () => undefined).mark(workspace, ['a.ts']);
    expect(await readdir(root)).toHaveLength(2);

    expect(await new ReviewStore(root, knownGuid).marks(workspace)).toEqual([{ path: 'a.ts', state: 'reviewed', hasSnapshot: true }]);
    expect(await readdir(root)).toEqual([GUID]);
  });

  it("keeps showing the marks kept by the path when their folder can't be moved (a file open in it, on Windows)", async () => {
    await write('a.ts', 'one');
    await new ReviewStore(root, async () => undefined).mark(workspace, ['a.ts']);
    const [byPath] = await readdir(root);
    const unmovable = new ReviewStore(root, knownGuid, async () => {
      throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
    });

    expect(await unmovable.marks(workspace)).toEqual([{ path: 'a.ts', state: 'reviewed', hasSnapshot: true }]);
    expect(await readdir(root)).toEqual([byPath]);
  });

  it("reads the GUID again after a read that failed, keeping no empty marks meanwhile", async () => {
    await write('a.ts', 'one');
    await store.mark(workspace, ['a.ts']);
    let fails = true;
    const flaky = new ReviewStore(root, async () => {
      if (fails) throw new Error('cm failed');
      return GUID;
    });

    await expect(flaky.marks(workspace)).rejects.toThrow('cm failed');
    fails = false;
    expect(await flaky.marks(workspace)).toEqual([{ path: 'a.ts', state: 'reviewed', hasSnapshot: true }]);
  });
});
