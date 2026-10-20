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

  it('restores nothing over an item that took its place, and says so', async () => {
    const items = restorer([WORKSPACE, join(WORKSPACE, 'src'), join(WORKSPACE, 'docs')]);
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, docs], items, context())).resolves.toEqual({
      restored: 0,
      total: 2,
      refused: { kind: 'placeTaken', path: 'docs', message: 'docs is already in the workspace. Restore it to another path.' },
    });
    expect(items.cm).not.toHaveBeenCalled();
  });

  it('needs the folder it goes back into: cm writes the files, then fails, leaving them private', async () => {
    const items = restorer([WORKSPACE]);
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy], items, context())).resolves.toEqual({
      restored: 0,
      total: 1,
      refused: { kind: 'folderMissing', path: 'src/Enemy.cs', message: 'src isn’t in the workspace. Restore src/Enemy.cs to another folder.' },
    });
    expect(items.cm).not.toHaveBeenCalled();
  });

  it("restores only revisions of the workspace's repository, which cm finds by a bare id", async () => {
    const items = restorer();
    const xlinked = { revision: { revisionId: 18, repository: 'thirdparty@local' }, path: 'src/Enemy.cs' };
    const outcome = await restoreDeletedItems(WORKSPACE, repository, [enemy, xlinked], items, context());
    expect(outcome.refused).toEqual({
      kind: 'otherRepository',
      path: 'src/Enemy.cs',
      message: 'src/Enemy.cs is in thirdparty@local, not in the workspace’s repository: it can’t be restored here.',
    });
    expect(items.cm).not.toHaveBeenCalled();
  });

  it("stops at cm's first refusal, telling it in the app's words, and what came back before it", async () => {
    const items = restorer();
    const command = { commandLine: 'undelete revid:24 /ws/docs', exitCode: 1, output: '', logEntryId: 1 };
    items.cm.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new CmError("The item 35 is already loaded on tree on path '/docs'.", command));
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, docs, enemy], items, context())).resolves.toEqual({
      restored: 1,
      total: 3,
      refused: { kind: 'alreadyLoaded', path: 'docs', loadedPath: 'docs', message: 'The workspace already has this item, at docs.' },
    });
    expect(items.cm).toHaveBeenCalledTimes(2);
  });

  it('fails on any other failure, as cm tells it', async () => {
    const items = restorer();
    items.cm.mockRejectedValueOnce(new Error('Could not connect to the server.'));
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, docs], items, context())).rejects.toThrow('Could not connect');
    expect(items.cm).toHaveBeenCalledTimes(1);
  });

  it('stops between items once stopped, never in the middle of one, saying what came back', async () => {
    const controller = new AbortController();
    const items = restorer();
    items.cm.mockImplementationOnce(async () => {
      controller.abort();
      return undefined;
    });
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, docs], items, context(controller.signal))).resolves.toEqual({ restored: 1, total: 2, stopped: true });
    expect(items.cm).toHaveBeenCalledTimes(1);
  });

  it('counts the items restored', async () => {
    const progress = context();
    await expect(restoreDeletedItems(WORKSPACE, repository, [enemy, docs], restorer(), progress)).resolves.toEqual({ restored: 2, total: 2 });
    expect(progress.reportProgress.mock.calls).toEqual([
      ['Restoring items', { current: 0, total: 2 }],
      ['Restoring items', { current: 1, total: 2 }],
      ['Restoring items', { current: 2, total: 2 }],
    ]);
  });
});
