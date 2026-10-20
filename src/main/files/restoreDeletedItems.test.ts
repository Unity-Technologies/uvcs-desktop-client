import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { restoreDeletedItems } from './restoreDeletedItems';

const WORKSPACE = join('/', 'ws');
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
    await restoreDeletedItems(WORKSPACE, [enemy, docs], items, context());
    expect(items.cm.mock.calls).toEqual([
      [['undelete', 'revid:18', join(WORKSPACE, 'src', 'Enemy.cs')]],
      [['undelete', 'revid:24', join(WORKSPACE, 'docs')]],
    ]);
  });

  it('never restores over an item that took its place, and restores nothing then', async () => {
    const items = restorer([WORKSPACE, join(WORKSPACE, 'src'), join(WORKSPACE, 'docs')]);
    await expect(restoreDeletedItems(WORKSPACE, [enemy, docs], items, context())).rejects.toThrow('docs is already in the workspace. Restore it to another path.');
    expect(items.cm).not.toHaveBeenCalled();
  });

  it('needs the folder it goes back into: cm writes the files, then fails, leaving them private', async () => {
    const items = restorer([WORKSPACE]);
    await expect(restoreDeletedItems(WORKSPACE, [enemy], items, context())).rejects.toThrow('src isn’t in the workspace. Restore src/Enemy.cs to another folder.');
    expect(items.cm).not.toHaveBeenCalled();
  });

  it('stops at the first failure', async () => {
    const items = restorer();
    items.cm.mockRejectedValueOnce(new Error('The item 35 is already loaded on tree'));
    await expect(restoreDeletedItems(WORKSPACE, [enemy, docs], items, context())).rejects.toThrow('already loaded');
    expect(items.cm).toHaveBeenCalledTimes(1);
  });

  it('stops between items once stopped, never in the middle of one', async () => {
    const controller = new AbortController();
    const items = restorer();
    items.cm.mockImplementationOnce(async () => {
      controller.abort();
      return undefined;
    });
    await expect(restoreDeletedItems(WORKSPACE, [enemy, docs], items, context(controller.signal))).rejects.toThrow('Stopped');
    expect(items.cm).toHaveBeenCalledTimes(1);
  });

  it('counts the items restored', async () => {
    const progress = context();
    await restoreDeletedItems(WORKSPACE, [enemy, docs], restorer(), progress);
    expect(progress.reportProgress.mock.calls).toEqual([
      ['Restoring items', { current: 0, total: 2 }],
      ['Restoring items', { current: 1, total: 2 }],
      ['Restoring items', { current: 2, total: 2 }],
    ]);
  });
});
