import { join, resolve, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CmError } from '../cm/CmError';
import { restoreDeletedItems } from './restoreDeletedItems';

// As `workspaceFileOf` resolves it: on Windows, on the current drive (`D:\ws`).
const WORKSPACE = resolve(sep, 'ws');
const repository = 'game@local';
const enemy = { revision: { revisionId: 18, repository }, path: 'src/Enemy.cs' };
const docs = { revision: { revisionId: 24, repository }, path: 'docs' };

/** A restorer over a disk holding `existing` (absolute paths), the workspace and its `src` folder by default. */
function restorer(existing: string[] = [WORKSPACE, join(WORKSPACE, 'src')]) {
  return {
    cm: vi.fn(async () => undefined),
    exists: vi.fn(async (path: string) => existing.includes(path)),
  };
}

const context = (signal = new AbortController().signal) => ({ signal, reportProgress: vi.fn() });

describe('restoreDeletedItems', () => {
  it('restores each item with a cm undelete of its own, in the order asked', async () => {
    const items = restorer();
    await restoreDeletedItems(WORKSPACE, repository, [enemy, docs], items, context());
    expect(items.cm.mock.calls).toEqual([
      [['undelete', 'revid:18', join(WORKSPACE, 'src', 'Enemy.cs')]],
      [['undelete', 'revid:24', join(WORKSPACE, 'docs')]],
    ]);
  });

  it('never restores over an item that took its place, and restores nothing then', async () => {
    const items = restorer([WORKSPACE, join(WORKSPACE, 'src'), join(WORKSPACE, 'docs')]);
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, docs], items, context())).rejects.toThrow('docs is already in the workspace. Restore it to another path.');
    expect(items.cm).not.toHaveBeenCalled();
  });

  it('needs the folder it goes back into: cm writes the files, then fails, leaving them private', async () => {
    const items = restorer([WORKSPACE]);
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy], items, context())).rejects.toThrow('src isn’t in the workspace. Restore src/Enemy.cs to another folder.');
    expect(items.cm).not.toHaveBeenCalled();
  });

  it("restores only revisions of the workspace's repository, which cm finds by a bare id", async () => {
    const items = restorer();
    const xlinked = { revision: { revisionId: 18, repository: 'thirdparty@local' }, path: 'src/Enemy.cs' };
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, xlinked], items, context())).rejects.toThrow(
      'src/Enemy.cs is in thirdparty@local, not in the workspace’s repository: it can’t be restored here.',
    );
    expect(items.cm).not.toHaveBeenCalled();
  });

  it("tells cm's refusal in the app's words, keeping the command for its details", async () => {
    const items = restorer();
    const command = { commandLine: 'undelete revid:18 /ws/src/Old.cs', exitCode: 1, output: '', logEntryId: 1 };
    items.cm.mockRejectedValueOnce(new CmError("The item 35 is already loaded on tree on path '/src/Enemy.cs'.", command));
    const restoring = restoreDeletedItems(WORKSPACE, repository, [{ ...enemy, path: 'src/Old.cs' }], items, context());
    await expect(restoring).rejects.toMatchObject({ message: 'The workspace already has this item, at src/Enemy.cs.', command });
  });

  it('stops at the first failure', async () => {
    const items = restorer();
    items.cm.mockRejectedValueOnce(new Error('The item 35 is already loaded on tree'));
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, docs], items, context())).rejects.toThrow('already loaded');
    expect(items.cm).toHaveBeenCalledTimes(1);
  });

  it('stops between items once stopped, never in the middle of one', async () => {
    const controller = new AbortController();
    const items = restorer();
    items.cm.mockImplementationOnce(async () => {
      controller.abort();
      return undefined;
    });
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, docs], items, context(controller.signal))).rejects.toThrow('Stopped');
    expect(items.cm).toHaveBeenCalledTimes(1);
  });

  it('counts the items restored', async () => {
    const progress = context();
    await restoreDeletedItems(WORKSPACE, repository, [enemy, docs], restorer(), progress);
    expect(progress.reportProgress.mock.calls).toEqual([
      ['Restoring items', { current: 0, total: 2 }],
      ['Restoring items', { current: 1, total: 2 }],
      ['Restoring items', { current: 2, total: 2 }],
    ]);
  });
});
