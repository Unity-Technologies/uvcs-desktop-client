import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';

import type { MergeRequest } from '@shared/domain/merge';
import { navigation } from '../../app/navigation/navigationStore';
import { useFinishedTasksStore } from '../mergeTask/finishedTask';
import type { TaskMerge } from '../mergeTask/taskMerge';
import { pressToastAction, shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { completeMerge } from './mergeOperations';

const ws = '/ws';
const resolutions = { directoryConflicts: [], files: {} };

describe('completeMerge', () => {
  it('refreshes what a checkin would after merging a branch into the workspace', async () => {
    fakeApi.answer('merge.run', () => ({}));
    const refreshed = watchRefreshes(ws);

    await completeMerge(ws, { kind: 'merge', sourceSpec: 'br:/main/task' }, resolutions);

    expect(refreshed()).toEqual(['annotate', 'branchExplorer', 'branches', 'changesets', 'explorer', 'history', 'incoming', 'info', 'locks', 'pendingChanges', 'review']);
  });

  it('refreshes the workspace, its locks, the shelve lists and the left changes after applying a shelve', async () => {
    fakeApi.answer('merge.run', () => ({}));
    const refreshed = watchRefreshes(ws);

    await completeMerge(ws, { kind: 'merge', sourceSpec: 'sh:12' }, resolutions);

    expect(refreshed()).toEqual(['explorer', 'info', 'leftChanges', 'locks', 'pendingChanges', 'review', 'shelves']);
  });

  it('refreshes what a new changeset on the server changes after a merge into a server branch, never the workspace', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 42 }));
    const refreshed = watchRefreshes(ws);

    await completeMerge(ws, { kind: 'merge', sourceSpec: 'br:/main/task', destinationBranch: '/main' }, resolutions);

    expect(refreshed()).toEqual(['branchExplorer', 'branches', 'changesets', 'history', 'incoming', 'locks']);
  });
});

describe('completing a merge', () => {
  const intoWorkspace: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task' };
  const intoServerBranch: MergeRequest = { ...intoWorkspace, destinationBranch: '/main' };

  it('stays on the page after merging into the workspace, for the user to review and check in', async () => {
    fakeApi.answer('merge.run', () => ({}));
    navigation.openPage({ kind: 'merge', request: intoWorkspace });

    expect(await completeMerge(ws, intoWorkspace, resolutions)).toEqual({});
    expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: intoWorkspace }]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Merge applied to your workspace' }]);
  });

  it('goes back to where it was opened from after merging into a server branch, with one toast naming the new changeset', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 42 }));
    navigation.openPage({ kind: 'merge', request: intoServerBranch });

    expect(await completeMerge(ws, intoServerBranch, resolutions)).toBeNull();
    expect(whereTheWindowIs()).toEqual({ view: 'changes', pages: [] });
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Merged /main/task into /main (cs:42)', action: 'Show in Branch Explorer' }]);

    pressToastAction('Merged /main/task into /main (cs:42)');
    expect(whereTheWindowIs().view).toBe('branchExplorer');
  });

  it('opens the merge that finishes it when the destination moved meanwhile, instead of the success', async () => {
    fakeApi.answer('merge.run', () => ({ changesetId: 42, destinationMoved: true }));
    navigation.openPage({ kind: 'merge', request: intoServerBranch });

    expect(await completeMerge(ws, intoServerBranch, resolutions)).toBeNull();
    expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: { kind: 'merge', sourceSpec: 'cs:42', destinationBranch: '/main' } }]);
    expect(shownToasts().map(({ kind, title }) => ({ kind, title }))).toEqual([{ kind: 'info', title: '/main moved while merging' }]);
  });

  describe('finishing a task', () => {
    const task: TaskMerge = { branch: { id: 7, name: '/main/task001', parent: '/main', comment: '' }, choices: { markReviewed: true, hideBranch: true } };
    const review = { id: 12, title: 'Task 001', status: 'Under review' as const, owner: 'ana', assignee: 'bob', date: '2026-09-01' };
    const finishTask: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task001', destinationBranch: '/main' };
    const writes = () => fakeApi.calls().map(({ method, args }) => [method, ...args.slice(1, 3)]);

    beforeEach(() => {
      fakeApi.answer('codeReviews.update', () => undefined);
      fakeApi.answer('branches.setHidden', () => undefined);
      useFinishedTasksStore.setState({ merged: {} });
    });

    it('marks its review reviewed, hides its branch and remembers where it landed, for Changes to say what is next', async () => {
      fakeApi.answer('merge.run', () => ({ changesetId: 42 }));
      navigation.openPage({ kind: 'merge', request: finishTask, task });

      await completeMerge(ws, finishTask, resolutions, { task, review });

      expect(writes()).toEqual([
        ['merge.run', finishTask, resolutions],
        ['codeReviews.update', 12, { status: 'Reviewed' }],
        ['branches.setHidden', ['/main/task001'], true],
      ]);
      expect(useFinishedTasksStore.getState().merged[ws]).toEqual({ branch: '/main/task001', destination: '/main', changesetId: 42, hidden: true });
      expect(whereTheWindowIs()).toEqual({ view: 'changes', pages: [] });
      expect(shownToasts()).toEqual([{ kind: 'success', title: 'Merged /main/task001 into /main (cs:42)', action: 'Show in Branch Explorer' }]);
    });

    it('leaves the review and the branch alone when not picked, still remembering the task', async () => {
      fakeApi.answer('merge.run', () => ({ changesetId: 42 }));

      await completeMerge(ws, finishTask, resolutions, { task: { ...task, choices: { markReviewed: false, hideBranch: false } }, review });

      expect(writes().map(([method]) => method)).toEqual(['merge.run']);
      expect(useFinishedTasksStore.getState().merged[ws]).toEqual({ branch: '/main/task001', destination: '/main', changesetId: 42, hidden: false });
    });

    it('refreshes only the reviews and the branch lists besides what the new changeset changes', async () => {
      fakeApi.answer('merge.run', () => ({ changesetId: 42 }));
      const refreshed = watchRefreshes(ws);

      await completeMerge(ws, finishTask, resolutions, { task, review });

      expect(refreshed()).toEqual(['branchExplorer', 'branches', 'changesets', 'codeReviews', 'history', 'incoming', 'locks']);
    });

    it('still finishes when marking the review fails, telling so', async () => {
      fakeApi.answer('merge.run', () => ({ changesetId: 42 }));
      fakeApi.answer('codeReviews.update', () => {
        throw new Error('No permission');
      });

      await completeMerge(ws, finishTask, resolutions, { task, review });

      expect(shownToasts().filter(({ kind }) => kind === 'error').map(({ title }) => title)).toEqual(["Couldn't mark the code review as reviewed"]);
      expect(writes().map(([method]) => method)).toEqual(['merge.run', 'codeReviews.update', 'branches.setHidden']);
    });

    it('leaves the task as it is until the merge that finishes it, when the destination moved, which carries the choices', async () => {
      fakeApi.answer('merge.run', () => ({ changesetId: 42, destinationMoved: true }));
      navigation.openPage({ kind: 'merge', request: finishTask, task });

      await completeMerge(ws, finishTask, resolutions, { task, review });

      expect(writes().map(([method]) => method)).toEqual(['merge.run']);
      expect(useFinishedTasksStore.getState().merged[ws]).toBeUndefined();
      expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: { kind: 'merge', sourceSpec: 'cs:42', destinationBranch: '/main' }, task }]);
    });

    it('names the task in the toast of the merge that finishes it', async () => {
      fakeApi.answer('merge.run', () => ({ changesetId: 43 }));
      const followUp: MergeRequest = { kind: 'merge', sourceSpec: 'cs:42', destinationBranch: '/main' };

      await completeMerge(ws, followUp, resolutions, { task, review });

      expect(shownToasts()).toEqual([{ kind: 'success', title: 'Merged /main/task001 into /main (cs:43)', action: 'Show in Branch Explorer' }]);
      expect(useFinishedTasksStore.getState().merged[ws]).toEqual({ branch: '/main/task001', destination: '/main', changesetId: 43, hidden: true });
    });
  });

  it('stays on the page when the merge fails', async () => {
    fakeApi.answer('merge.run', () => {
      throw new Error('The destination is locked');
    });
    navigation.openPage({ kind: 'merge', request: intoServerBranch });

    expect(await completeMerge(ws, intoServerBranch, resolutions)).toBeNull();
    expect(whereTheWindowIs().pages).toHaveLength(1);
    expect(shownToasts().map(({ kind, title }) => ({ kind, title }))).toEqual([{ kind: 'error', title: 'Merging failed' }]);
  });
});
