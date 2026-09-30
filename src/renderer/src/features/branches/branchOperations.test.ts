import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const asked = vi.hoisted(() => ({
  confirmed: true,
  typed: undefined as string | undefined,
  picked: undefined as string | undefined,
  picker: undefined as { exclude?: string } | undefined,
  switches: [] as unknown[][],
}));
vi.mock('../../ui/dialog/confirm', () => ({ confirm: async () => asked.confirmed }));
vi.mock('../../ui/dialog/prompt', () => ({ prompt: async () => asked.typed }));
vi.mock('./BranchPickerDialog', () => ({
  pickBranch: async (options: { exclude?: string }) => {
    asked.picker = options;
    return asked.picked;
  },
}));
vi.mock('../../app/shell/workspaceOperations', () => ({
  switchWorkspace: async (...args: unknown[]) => {
    asked.switches.push(args);
    return true;
  },
}));

import type { Branch } from '@shared/domain/branch';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { deleteBranches, mergeTo, renameBranch, setBranchesHidden, switchToBranch } from './branchOperations';

const ws = '/ws';
const branch = (name: string, guid = `guid-${name}`): Branch => ({ id: 1, name, parent: '/main', comment: '', owner: 'ana', date: '', headChangeset: 5, guid, repository: 'game@local' });

beforeEach(() => {
  asked.confirmed = true;
  asked.typed = undefined;
  asked.picked = undefined;
  asked.picker = undefined;
  asked.switches.length = 0;
});

describe('switching to a branch', () => {
  it('switches through the one switch flow, and records the branch among the recent ones from a list already read', async () => {
    queryClient.setQueryData(queryKeys.inWorkspace(ws, 'branches', {}), [branch('/main'), branch('/main/task')]);
    fakeApi.answer('branches.rememberRecent', () => undefined);

    expect(await switchToBranch(ws, '/main/task', 'bring')).toBe(true);

    expect(asked.switches).toEqual([[ws, 'br:/main/task', '/main/task', 'bring']]);
    await vi.waitFor(() => expect(fakeApi.calls()).toEqual([{ method: 'branches.rememberRecent', args: [ws, 'guid-/main/task'] }]));
  });

  it('reads one branch by name to record it when no list has it', async () => {
    fakeApi.answer('branches.get', () => branch('/main/task', 'guid-read'));
    fakeApi.answer('branches.rememberRecent', () => undefined);

    await switchToBranch(ws, '/main/task');

    await vi.waitFor(() => expect(fakeApi.methods()).toEqual(['branches.get', 'branches.rememberRecent']));
    expect(fakeApi.argsOf('branches.rememberRecent')).toEqual([[ws, 'guid-read']]);
  });

  it('still switches when the recent branches can’t be recorded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakeApi.answer('branches.get', () => {
      throw new Error('offline');
    });

    expect(await switchToBranch(ws, '/main/task')).toBe(true);

    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    warn.mockRestore();
  });
});

describe('branch operations', () => {
  it('renames only the last part of the name, as typed', async () => {
    asked.typed = 'login';
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
    asked.confirmed = false;

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
