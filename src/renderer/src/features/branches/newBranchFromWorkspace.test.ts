import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const opened = vi.hoisted(() => [] as unknown[][]);
vi.mock('./CreateBranchDialog', () => ({ openCreateBranchDialog: (...args: unknown[]) => void opened.push(args) }));

import type { WorkspaceInfo, WorkspaceSelector } from '@shared/domain/workspace';
import { shownToasts } from '../../testing/operationOutcome';
import { newBranchFromWorkspace } from './newBranchFromWorkspace';

const ws = '/ws';
const workspaceOn = (selector: WorkspaceSelector, loadedChangeset: number | null): WorkspaceInfo => ({
  name: 'ws',
  path: ws,
  repository: 'game@local',
  repositoryName: 'game',
  server: 'local',
  selector,
  loadedChangeset,
});

/** Where each starting point offered begins: the parent branch and the spec. */
function offered(): string[] {
  const [call] = opened;
  return (call?.slice(1) as { parentBranch: string; startingPoint: string }[]).map((origin) => `${origin.parentBranch} @ ${origin.startingPoint}`);
}

beforeEach(() => {
  opened.length = 0;
});

describe('a new branch from the workspace', () => {
  it('starts on /main from what it has loaded, asking the server nothing', async () => {
    await newBranchFromWorkspace(workspaceOn({ kind: 'branch', name: '/main' }, 90));

    expect(fakeApi.methods()).toEqual([]);
    expect(offered()).toEqual(['/main @ cs:90']);
  });

  it('away from /main, offers the latest /main first, then building on what is loaded', async () => {
    fakeApi.answer('changesets.list', () => [{ id: 120 }]);

    await newBranchFromWorkspace(workspaceOn({ kind: 'branch', name: '/main/task' }, 90));

    expect(fakeApi.argsOf('changesets.list')).toEqual([[ws, { branch: '/main', limit: 1 }]]);
    expect(offered()).toEqual(['/main @ cs:120', '/main/task @ cs:90']);
  });

  it('names the branches on its cards by their own names, the new branch’s parent in full', async () => {
    fakeApi.answer('changesets.list', () => [{ id: 120 }]);

    await newBranchFromWorkspace(workspaceOn({ kind: 'branch', name: '/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test' }, 90));

    const origins = opened[0]!.slice(1) as { parentBranch: string; card: { title: string } }[];
    expect(origins.map((origin) => origin.card.title)).toEqual(['main (latest, changeset 120)', 'merge-test (changeset 90, what you have loaded)']);
    expect(origins[1]!.parentBranch).toBe('/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test');
  });

  it('keeps a label loaded as the label, a child of /main', async () => {
    fakeApi.answer('changesets.list', () => [{ id: 120 }]);

    await newBranchFromWorkspace(workspaceOn({ kind: 'label', name: 'v1.0' }, 90));

    expect(offered()).toEqual(['/main @ cs:120', '/main @ lb:v1.0']);
  });

  it('offers only the latest /main on a shelve, which no branch can start from', async () => {
    fakeApi.answer('changesets.list', () => [{ id: 120 }]);

    await newBranchFromWorkspace(workspaceOn({ kind: 'shelve', name: '3' }, null));

    expect(offered()).toEqual(['/main @ cs:120']);
  });

  it('offers what is loaded when the latest /main can’t be read', async () => {
    fakeApi.answer('changesets.list', () => {
      throw new Error('offline');
    });

    await newBranchFromWorkspace(workspaceOn({ kind: 'changeset', name: '90' }, 90));

    expect(offered()).toEqual(['/main @ cs:90']);
  });

  it('explains instead of opening an empty dialog on a shelve with /main unreadable', async () => {
    fakeApi.answer('changesets.list', () => {
      throw new Error('offline');
    });

    await newBranchFromWorkspace(workspaceOn({ kind: 'shelve', name: '3' }, null));

    expect(opened).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't start a new branch", detail: "The workspace is on a shelve, and the latest /main couldn't be read." }]);
  });
});
