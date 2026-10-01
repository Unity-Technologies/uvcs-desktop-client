import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

import type { LeftChanges, RestoreResult } from '@shared/domain/switchWithChanges';
import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { discardLeftChanges, restoreLeftChanges } from './leftChangesOperations';

const ws = '/ws';
const confirmTitles = () => askedDialogs().map((dialog) => dialog.title);

const left = (shelveId: number, reason: LeftChanges['reason'] = 'switch'): LeftChanges => ({
  shelveId,
  sourceName: '/main/task',
  targetName: '/main',
  mode: 'leave',
  reason,
  count: 3,
  createdAt: '2026-09-27T10:00:00Z',
  foreign: false,
});

function restoreAnswers(result: RestoreResult): void {
  fakeApi.answer('leftChanges.restore', () => result);
}

describe('restoreLeftChanges', () => {
  it('restores the shelve and says where the changes were left, with a way to see them', async () => {
    restoreAnswers({ kind: 'restored', count: 3, sourceName: '/main/task' });

    await restoreLeftChanges(ws, left(12));

    expect(fakeApi.argsOf('leftChanges.restore')).toEqual([[ws, 12, expect.any(String)]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Restored 3 changes you left on task', action: 'View' }]);
  });

  it('refreshes the workspace, its locks, the shelve lists and the left changes, not the repository', async () => {
    restoreAnswers({ kind: 'restored', count: 3, sourceName: '/main/task' });
    const refreshed = watchRefreshes(ws);

    await restoreLeftChanges(ws, left(12));

    expect(refreshed()).toEqual(['explorer', 'info', 'leftChanges', 'locks', 'pendingChanges', 'review', 'shelves']);
  });

  it('says changes put aside to update were put aside, not left', async () => {
    restoreAnswers({ kind: 'restored', count: 1, sourceName: '/main' });

    await restoreLeftChanges(ws, left(12, 'update'));

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Restored 1 change you put aside', action: 'View' }]);
  });

  it('restores nothing over pending changes, and says what to do first', async () => {
    restoreAnswers({ kind: 'pendingChanges' });

    await restoreLeftChanges(ws, left(12));

    expect(shownToasts()).toEqual([
      { kind: 'info', title: 'Your changes weren’t restored', detail: 'Check in, shelve or undo your current changes first, then restore.' },
    ]);
  });

  it('opens the merge view on conflicts', async () => {
    restoreAnswers({ kind: 'conflicts', shelveId: 12 });

    await restoreLeftChanges(ws, left(12));

    expect(whereTheWindowIs().pages).toEqual([{ kind: 'merge', request: { kind: 'merge', sourceSpec: 'sh:12' } }]);
    expect(shownToasts()).toEqual([]);
  });

  it('reports a failed restore and goes nowhere', async () => {
    fakeApi.answer('leftChanges.restore', () => {
      throw commandFailure('The shelve does not exist');
    });

    await restoreLeftChanges(ws, left(12));

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Restoring your changes from task failed', detail: 'The shelve does not exist' }]);
    expect(whereTheWindowIs().pages).toEqual([]);
  });
});

describe('discardLeftChanges', () => {
  it('deletes every shelve picked at once, once confirmed', async () => {
    fakeApi.answer('leftChanges.discard', () => undefined);

    await discardLeftChanges(ws, [left(11), left(9)]);

    expect(confirmTitles()).toEqual(['Discard 2 older shelves?']);
    expect(fakeApi.argsOf('leftChanges.discard')).toEqual([[ws, [11, 9]]]);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Discarded 2 shelves' }]);
  });

  it('names the one shelve discarded', async () => {
    fakeApi.answer('leftChanges.discard', () => undefined);

    await discardLeftChanges(ws, [left(12)]);

    expect(confirmTitles()).toEqual(['Discard these shelved changes?']);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Discarded shelve 12' }]);
  });

  it('refreshes only the left changes and the shelve lists', async () => {
    fakeApi.answer('leftChanges.discard', () => undefined);
    const refreshed = watchRefreshes(ws);

    await discardLeftChanges(ws, [left(12)]);

    expect(refreshed()).toEqual(['leftChanges', 'shelves']);
  });

  it('discards nothing unless confirmed', async () => {
    answerConfirms(false);

    await discardLeftChanges(ws, [left(12)]);

    expect(fakeApi.methods()).toEqual([]);
  });
});
