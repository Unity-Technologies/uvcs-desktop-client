import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';

import { watchRefreshes } from '../../testing/operationOutcome';
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
});
