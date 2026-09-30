import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recorded = vi.hoisted(() => ({
  switchesTo: [] as string[],
  switchSucceeds: true,
  openedMerges: [] as unknown[],
}));

vi.mock('../branchExplorer/branchExplorerStore', () => ({ showInBranchExplorer: () => {} }));
vi.mock('../branches/branchOperations', () => ({
  switchToBranch: async (_workspacePath: string, branch: string) => {
    recorded.switchesTo.push(branch);
    return recorded.switchSucceeds;
  },
}));
vi.mock('../merge/mergeOperations', () => ({ openMerge: (request: unknown) => recorded.openedMerges.push(request) }));

import type { MergeRequest } from '@shared/domain/merge';
import { shownToasts } from '../../testing/operationOutcome';
import { useFinishedTasksStore } from './finishedTask';
import { mergeDestinationIntoTask, mergeTaskOnServer, resolveOnDestination } from './mergeTaskOperations';

const ws = '/ws';
const request: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task001', destinationBranch: '/main' };
const options = { taskBranch: '/main/task001', comment: 'Task 001', hideBranch: true, review: { id: 12, title: 'Task 001', status: 'Under review' as const, owner: 'ana', assignee: 'bob', date: '2026-09-01' } };
const writes = () => fakeApi.calls().map(({ method, args }) => [method, ...args.slice(1)]);
const failures = () => shownToasts().filter((toast) => toast.kind === 'error').map((toast) => toast.title);

beforeEach(() => {
  Object.assign(recorded, { switchesTo: [], switchSucceeds: true, openedMerges: [] });
  fakeApi.answer('codeReviews.update', () => undefined);
  fakeApi.answer('branches.setHidden', () => undefined);
  useFinishedTasksStore.setState({ merged: {} });
});

describe('finishing a task on the server', () => {
  it('merges it with nothing to decide, marks its review reviewed, hides the branch and remembers where it landed', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 42 }));
    expect(await mergeTaskOnServer(ws, request, options)).toEqual({ changesetId: 42 });
    expect(writes()).toEqual([
      ['merge.run', request, { directoryConflicts: [], files: {}, comment: 'Task 001' }, expect.any(String)],
      ['codeReviews.update', 12, { status: 'Reviewed' }],
      ['branches.setHidden', ['/main/task001'], true],
    ]);
    expect(useFinishedTasksStore.getState().merged[ws]).toEqual({ branch: '/main/task001', destination: '/main', changesetId: 42, hidden: true });
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Merged /main/task001 into /main (cs:42)', action: 'Show in Branch Explorer' }]);
  });

  it('leaves the review and the branch alone when not asked to', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 42 }));
    await mergeTaskOnServer(ws, request, { ...options, review: undefined, hideBranch: false });
    expect(writes().map(([method]) => method)).toEqual(['merge.run']);
  });

  it('stops after the merge when the destination moved meanwhile, for the second merge to finish it', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 42, destinationMoved: true }));
    expect(await mergeTaskOnServer(ws, request, options)).toEqual({ changesetId: 42, destinationMoved: true });
    expect(writes().map(([method]) => method)).toEqual(['merge.run']);
    expect(useFinishedTasksStore.getState().merged[ws]).toBeUndefined();
    expect(shownToasts()).toEqual([]);
  });

  it('does nothing more when the merge fails', async () => {
    fakeApi.answer('merge.run', () => {
      throw new Error('The destination is locked');
    });
    expect(await mergeTaskOnServer(ws, request, options)).toBeUndefined();
    expect(writes().map(([method]) => method)).toEqual(['merge.run']);
    expect(failures()).toEqual(['Merging /main/task001 into /main failed']);
  });

  it('still finishes when marking the review fails, telling so', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 42 }));
    fakeApi.answer('codeReviews.update', () => {
      throw new Error('No permission');
    });
    await mergeTaskOnServer(ws, request, options);
    expect(failures()).toEqual(["Couldn't mark the code review as reviewed"]);
    expect(writes().map(([method]) => method)).toEqual(['merge.run', 'codeReviews.update', 'branches.setHidden']);
  });
});

describe('resolving a task in the workspace', () => {
  it('brings the destination into the task, switching to the task first when needed', async () => {
    await mergeDestinationIntoTask(ws, '/main', '/main/task001', '/main');
    await mergeDestinationIntoTask(ws, '/main/task001', '/main/task001', '/main');
    expect(recorded.switchesTo).toEqual(['/main/task001']);
    expect(recorded.openedMerges).toEqual([
      { kind: 'merge', sourceSpec: 'br:/main' },
      { kind: 'merge', sourceSpec: 'br:/main' },
    ]);
  });

  it('merges the task into the destination, and opens nothing when the switch fails', async () => {
    await resolveOnDestination(ws, '/main/task001', 'br:/main/task001', '/main');
    recorded.switchSucceeds = false;
    await resolveOnDestination(ws, '/main/task001', 'br:/main/task001', '/main');
    expect(recorded.switchesTo).toEqual(['/main', '/main']);
    expect(recorded.openedMerges).toEqual([{ kind: 'merge', sourceSpec: 'br:/main/task001' }]);
  });
});
