import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({
  picked: undefined as string | undefined,
  picker: undefined as { exclude?: string } | undefined,
  switches: [] as unknown[][],
  /** Whether the switch goes through (false: the user cancelled it, or it failed). */
  switchSucceeds: true,
}));
vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));
vi.mock('./BranchPickerDialog', () => ({
  pickBranch: async (options: { exclude?: string }) => {
    asked.picker = options;
    return asked.picked;
  },
}));
vi.mock('../../app/shell/workspaceOperations', () => ({
  switchWorkspace: async (...args: unknown[]) => {
    asked.switches.push(args);
    return asked.switchSucceeds;
  },
}));

import type { Branch } from '@shared/domain/branch';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { answerConfirms, answerPrompts } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { createBranchAndSwitch, deleteBranches, mergeTo, renameBranch, setBranchesHidden, switchToBranch, type SwitchToNewBranch } from './branchOperations';

const ws = '/ws';
const branch = (name: string, guid = `guid-${name}`): Branch => ({ id: 1, name, parent: '/main', comment: '', owner: 'ana', date: '', headChangeset: 5, guid, repository: 'game@local' });

beforeEach(() => {
  asked.picked = undefined;
  asked.picker = undefined;
  asked.switches.length = 0;
  asked.switchSucceeds = true;
});
afterEach(() => vi.restoreAllMocks());

/** Resolves with the arguments `branches.rememberRecent` is called with: recording runs on its own, after the switch starts. */
function recordedRecent(): Promise<unknown[]> {
  return new Promise((resolve) => fakeApi.answer('branches.rememberRecent', (...args: unknown[]) => void resolve(args)));
}

describe('switching to a branch', () => {
  it('switches through the one switch flow, and records the branch among the recent ones from a list already read', async () => {
    queryClient.setQueryData(queryKeys.inWorkspace(ws, 'branches', {}), [branch('/main'), branch('/main/task')]);
    const recorded = recordedRecent();

    expect(await switchToBranch(ws, '/main/task', 'bring')).toBe(true);

    expect(asked.switches).toEqual([[ws, 'br:/main/task', '/main/task', 'bring']]);
    expect(await recorded).toEqual([ws, 'guid-/main/task']);
    expect(fakeApi.methods()).toEqual(['branches.rememberRecent']);
  });

  it('reads one branch by name to record it when no list has it', async () => {
    fakeApi.answer('branches.get', () => branch('/main/task', 'guid-read'));
    const recorded = recordedRecent();

    await switchToBranch(ws, '/main/task');

    expect(await recorded).toEqual([ws, 'guid-read']);
    expect(fakeApi.methods()).toEqual(['branches.get', 'branches.rememberRecent']);
  });

  it('still switches when the recent branches can’t be recorded', async () => {
    const warned = new Promise<void>((resolve) => vi.spyOn(console, 'warn').mockImplementation(() => resolve()));
    fakeApi.answer('branches.get', () => {
      throw new Error('offline');
    });

    expect(await switchToBranch(ws, '/main/task')).toBe(true);

    await warned;
  });
});

describe('creating a branch and switching to it', () => {
  const request = { name: '/main/task', startingPoint: 'cs:12', comment: 'The task' };
  const switchTo = (overrides: Partial<SwitchToNewBranch> = {}): SwitchToNewBranch => ({ requested: true, blockedByMerge: false, workspaceOn: '/main', ...overrides });

  beforeEach(() => {
    fakeApi.answer('branches.create', () => undefined);
    // A switch records the branch among the recent ones, from the list the refresh read.
    queryClient.setQueryData(queryKeys.inWorkspace(ws, 'branches', {}), [branch('/main/task')]);
    fakeApi.answer('branches.rememberRecent', () => undefined);
  });

  it('refreshes once, after the switch: creating the branch refreshes nothing by itself', async () => {
    const refreshed = watchRefreshes(ws);
    const order: string[] = [];

    const created = await createBranchAndSwitch(ws, request, switchTo({ pendingChanges: 'bring' }), () => order.push(`created, ${asked.switches.length} switches`));

    expect(created).toBe(true);
    expect(fakeApi.argsOf('branches.create')).toEqual([[ws, request]]);
    expect(order).toEqual(['created, 0 switches']);
    expect(asked.switches).toEqual([[ws, 'br:/main/task', '/main/task', 'bring']]);
    expect(refreshed()).toEqual([]);
    expect(shownToasts()).toEqual([]);
  });

  it('refreshes only the branch lists and the graph when the workspace stays, and says so', async () => {
    const refreshed = watchRefreshes(ws);

    await createBranchAndSwitch(ws, request, switchTo({ requested: false }));

    expect(asked.switches).toEqual([]);
    expect(refreshed()).toEqual(['branchExplorer', 'branches']);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Created /main/task' }]);
  });

  it('offers the switch again when it was cancelled or failed, having refreshed the branch lists', async () => {
    asked.switchSucceeds = false;
    const refreshed = watchRefreshes(ws);

    await createBranchAndSwitch(ws, request, switchTo());

    expect(asked.switches).toHaveLength(1);
    expect(refreshed()).toEqual(['branchExplorer', 'branches']);
    expect(shownToasts()).toEqual([{ kind: 'info', title: "Created /main/task — you're still on /main", action: 'Switch' }]);
  });

  it('never tries to switch in the middle of a merge', async () => {
    const refreshed = watchRefreshes(ws);

    await createBranchAndSwitch(ws, request, switchTo({ blockedByMerge: true }));

    expect(asked.switches).toEqual([]);
    expect(refreshed()).toEqual(['branchExplorer', 'branches']);
    expect(shownToasts()).toEqual([{ kind: 'info', title: "Created /main/task — you're still on /main", action: 'Switch' }]);
  });

  it('reports a branch that couldn’t be created, switching and refreshing nothing', async () => {
    fakeApi.answer('branches.create', () => {
      throw commandFailure('The branch already exists');
    });
    const refreshed = watchRefreshes(ws);
    let createdCalls = 0;

    expect(await createBranchAndSwitch(ws, request, switchTo(), () => createdCalls++)).toBe(false);

    expect(createdCalls).toBe(0);
    expect(asked.switches).toEqual([]);
    expect(refreshed()).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't create the branch", detail: 'The branch already exists' }]);
  });
});

describe('branch operations', () => {
  it('renames only the last part of the name, as typed', async () => {
    answerPrompts('login');
    fakeApi.answer('branches.rename', () => undefined);

    await renameBranch(ws, branch('/main/task'));

    expect(fakeApi.argsOf('branches.rename')).toEqual([[ws, '/main/task', 'login']]);
  });

  it('renames nothing when cancelled', async () => {
    await renameBranch(ws, branch('/main/task'));

    expect(fakeApi.methods()).toEqual([]);
  });

  it('deletes the branches picked in one call, refreshing only the branch lists and the graph', async () => {
    fakeApi.answer('branches.delete', () => undefined);
    const refreshed = watchRefreshes(ws);

    await deleteBranches(ws, [branch('/main/a'), branch('/main/b')]);

    expect(fakeApi.argsOf('branches.delete')).toEqual([[ws, ['/main/a', '/main/b']]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Deleted 2 branches' }]);
    expect(refreshed()).toEqual(['branchExplorer', 'branches']);
  });

  it('deletes nothing unless confirmed', async () => {
    answerConfirms(false);

    await deleteBranches(ws, [branch('/main/a')]);

    expect(fakeApi.methods()).toEqual([]);
  });

  it("reports a branch that couldn't be deleted, with no success", async () => {
    fakeApi.answer('branches.delete', () => {
      throw commandFailure('The branch is not empty');
    });

    await deleteBranches(ws, [branch('/main/a')]);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't delete the branch", detail: 'The branch is not empty' }]);
  });

  it('hides and shows branches again, refreshing only the branch lists and the graph', async () => {
    fakeApi.answer('branches.setHidden', () => undefined);
    const refreshed = watchRefreshes(ws);

    await setBranchesHidden(ws, [branch('/main/a')], true);

    expect(fakeApi.argsOf('branches.setHidden')).toEqual([[ws, ['/main/a'], true]]);
    expect(refreshed()).toEqual(['branchExplorer', 'branches']);
  });
});

describe('merging to another branch', () => {
  it('opens the server merge into the branch picked, never offering the branch itself', async () => {
    asked.picked = '/main';

    await mergeTo('br:/main/task', '/main/task');

    expect(asked.picker?.exclude).toBe('/main/task');
    expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: { kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' } }]);
  });

  it('offers every branch when merging a changeset or label', async () => {
    await mergeTo('lb:v1', 'v1');

    expect(asked.picker?.exclude).toBeUndefined();
    expect(whereTheWindowIs().pages).toEqual([]);
  });
});
