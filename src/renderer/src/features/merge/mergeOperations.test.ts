import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';

import type { MergeRequest } from '@shared/domain/merge';
import { navigation } from '../../app/navigation/navigationStore';
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
