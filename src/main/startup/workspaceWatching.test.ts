import { describe, expect, it, vi } from 'vitest';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import type { Watcher } from '../watch/WorkspaceWatchers';
import { watchShownWorkspaces } from './workspaceWatching';

vi.mock('electron', () => ({ webContents: { fromId: () => undefined } }));

/** A watcher that sees every change at once and does nothing else. */
function quietWatcher(workspacePath: string): Watcher {
  return { workspacePath, start: async () => 'full', covers: () => true, ignoreOwnWrite: () => {}, stop: () => {} };
}

function setUp() {
  const reads: string[] = [];
  const branchNames = new BranchNamesCache(async (workspacePath) => {
    reads.push(workspacePath);
    return [{ id: 1, name: '/main' }];
  });
  const cm = { release: vi.fn() };
  const watchers = watchShownWorkspaces({ cm, headers: { forget: vi.fn() }, branchNames }, quietWatcher);
  return { watchers, cm, branchNames, reads };
}

describe('watchShownWorkspaces', () => {
  it("lets go of a workspace's cm sessions and branch names once no window shows it", async () => {
    const { watchers, cm, branchNames, reads } = setUp();
    await watchers.watch(1, '/wk/game');
    await watchers.watch(2, '/wk/game');
    await branchNames.resolve('/wk/game', [1]);

    watchers.release(1);
    await branchNames.resolve('/wk/game', [1]);
    expect(cm.release).not.toHaveBeenCalled();
    expect(reads).toEqual(['/wk/game']);

    watchers.release(2);
    await branchNames.resolve('/wk/game', [1]);
    expect(cm.release).toHaveBeenCalledWith('/wk/game');
    expect(reads).toEqual(['/wk/game', '/wk/game']);
  });
});
