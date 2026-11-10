import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));
// The reviewers' dialog renders the picker; a test says what the user picked in it, or that they cancelled.
vi.mock('./ReviewersDialog', () => ({ pickReviewers: vi.fn() }));

import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { MemberRef } from '@shared/domain/member';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes, watchRepositoryRefreshes } from '../../testing/operationOutcome';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { chooseReviewers, changeReviewers, deleteReviews, removeReviewer, renameReview, reRequestReview, setOwnReviewStatus } from './codeReviewOperations';
import { pickReviewers } from './ReviewersDialog';

const user = (name: string): MemberRef => ({ name, kind: 'user' });
const group = (name: string): MemberRef => ({ name, kind: 'group' });

const ws = '/ws';
const inWs = workspacePlace(ws);
const review = (reviewer: string, id = 31): CodeReviewSummary => codeReviewSummary({ id, reviewers: reviewer ? [{ name: reviewer, status: 'Under review' }] : [] });
const workspaceOn = (server: string) =>
  queryClient.setQueryData<WorkspaceInfo>(queryKeys.inWorkspace(ws, 'info'), {
    name: 'ws',
    path: ws,
    repository: `game@${server}`,
    repositoryName: 'game',
    server,
    selector: { kind: 'branch', name: '/main' },
    loadedChangeset: 5,
    kind: 'standard',
  });

describe('setting your own review status', () => {
  const signedInAs = (user: string) => {
    workspaceOn('local');
    fakeApi.answer('accounts.list', () => []);
    fakeApi.answer('system.currentUser', () => user);
  };

  it("sets a reviewer's own status, asking nothing", async () => {
    signedInAs('ana');
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);

    await setOwnReviewStatus(inWs, review('ana'), 'Reviewed');

    expect(askedDialogs()).toEqual([]);
    expect(fakeApi.argsOf('codeReviews.setOwnStatus')).toEqual([[inWs, 31, 'Reviewed']]);
  });

  it("adds a user who isn't a reviewer yet once they agree, then sets their status", async () => {
    signedInAs('eva');
    fakeApi.answer('codeReviews.addReviewers', () => undefined);
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);
    answerConfirms(true);

    await setOwnReviewStatus(inWs, review('ana'), 'Rework required');

    const reviewCalls = fakeApi.calls().filter(({ method }) => method.startsWith('codeReviews.'));
    expect(reviewCalls.map(({ method, args }) => [method, ...args.slice(1)])).toEqual([
      ['codeReviews.addReviewers', 31, [user('eva')]],
      ['codeReviews.setOwnStatus', 31, 'Rework required'],
    ]);
  });

  it('sends nothing when the user picks the status they gave already', async () => {
    signedInAs('ana');

    await setOwnReviewStatus(inWs, codeReviewSummary({ id: 31, reviewers: [{ name: 'ana', status: 'Reviewed' }] }), 'Reviewed');

    expect(fakeApi.methods().filter((method) => method.startsWith('codeReviews.'))).toEqual([]);
  });

  it("sets the status as the user is when they can't be read yet, asking nothing, so the server answers", async () => {
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);

    await setOwnReviewStatus(inWs, review('ana'), 'Reviewed');

    expect(askedDialogs()).toEqual([]);
    expect(fakeApi.argsOf('codeReviews.setOwnStatus')).toEqual([[inWs, 31, 'Reviewed']]);
  });

  it('takes the user the page already knows, reading no account', async () => {
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);

    await setOwnReviewStatus(inWs, review('ana'), 'Rework required', { user: 'ana' });

    expect(fakeApi.methods()).toEqual(['codeReviews.setOwnStatus']);
  });

  it("changes nothing when a user who isn't a reviewer declines", async () => {
    signedInAs('eva');
    answerConfirms(false);

    await setOwnReviewStatus(inWs, review('ana'), 'Reviewed');

    expect(fakeApi.methods()).toEqual(['accounts.list', 'system.currentUser']);
  });
});

describe('setting your own review status with a comment', () => {
  it('sends what the reviewer says with their status', async () => {
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);

    await setOwnReviewStatus(inWs, review('ana'), 'Reviewed', { user: 'ana', comment: 'Ship it' });

    expect(fakeApi.argsOf('codeReviews.setOwnStatus')).toEqual([[inWs, 31, 'Reviewed', 'Ship it']]);
  });

  it('sends a comment even with the status the reviewer gave already, and nothing without one', async () => {
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);

    await setOwnReviewStatus(inWs, review('ana'), 'Under review', { user: 'ana', comment: 'Looking again' });
    await setOwnReviewStatus(inWs, review('ana'), 'Under review', { user: 'ana', comment: '  ' });

    expect(fakeApi.argsOf('codeReviews.setOwnStatus')).toEqual([[inWs, 31, 'Under review', 'Looking again']]);
  });
});

describe('whether your status was set', () => {
  it('tells it was, or that the server refused it, so what the user wrote is kept to try again', async () => {
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);
    expect(await setOwnReviewStatus(inWs, review('ana'), 'Reviewed', { user: 'ana', comment: 'Ship it' })).toBe(true);

    fakeApi.answer('codeReviews.setOwnStatus', () => {
      throw new Error('Access denied');
    });
    expect(await setOwnReviewStatus(inWs, review('ana'), 'Reviewed', { user: 'ana', comment: 'Ship it' })).toBe(false);
  });

  it('tells it was set when there was nothing to change', async () => {
    expect(await setOwnReviewStatus(inWs, review('ana'), 'Under review', { user: 'ana' })).toBe(true);
  });
});

describe('joining as a reviewer from the page', () => {
  it('asks nothing of a user told already they will be added, and adds them before their status', async () => {
    fakeApi.answer('codeReviews.addReviewers', () => undefined);
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);

    await setOwnReviewStatus(inWs, review('ana'), 'Reviewed', { user: 'eva', joiningAgreed: true });

    expect(askedDialogs()).toEqual([]);
    expect(fakeApi.methods()).toEqual(['codeReviews.addReviewers', 'codeReviews.setOwnStatus']);
  });
});

describe('changing the reviewers', () => {
  it('adds and removes with one call each, reading only the reviews again', async () => {
    fakeApi.answer('codeReviews.addReviewers', () => undefined);
    fakeApi.answer('codeReviews.removeReviewers', () => undefined);
    const refreshed = watchRefreshes(ws);

    await changeReviewers(inWs, review('ana'), { add: [user('carl'), group('Developers')], remove: [user('ana')] });

    expect(fakeApi.calls().map(({ method, args }) => [method, ...args.slice(1)])).toEqual([
      ['codeReviews.addReviewers', 31, [user('carl'), group('Developers')]],
      ['codeReviews.removeReviewers', 31, [user('ana')]],
    ]);
    expect(refreshed()).toEqual(['codeReviews']);
  });

  it('asks nothing when the picker changed nothing, and only what changed otherwise', async () => {
    fakeApi.answer('codeReviews.removeReviewers', () => undefined);

    await changeReviewers(inWs, review('ana'), { add: [], remove: [] });
    await changeReviewers(inWs, review('ana'), { add: [], remove: [user('ana')] });

    expect(fakeApi.methods()).toEqual(['codeReviews.removeReviewers']);
  });

  it('removes one reviewer, or asks one to review again, a group as a group', async () => {
    fakeApi.answer('codeReviews.removeReviewers', () => undefined);
    fakeApi.answer('codeReviews.reRequestReview', () => undefined);

    await removeReviewer(inWs, review('ana'), user('ana'));
    await reRequestReview(inWs, review('Developers'), group('Developers'));

    expect(fakeApi.calls().map(({ method, args }) => [method, ...args.slice(1)])).toEqual([
      ['codeReviews.removeReviewers', 31, [user('ana')]],
      ['codeReviews.reRequestReview', 31, [group('Developers')]],
    ]);
  });
});

describe('review operations', () => {
  it('applies what the reviewers dialog picked, the review’s, with one call to add and one to remove', async () => {
    fakeApi.answer('codeReviews.addReviewers', () => undefined);
    fakeApi.answer('codeReviews.removeReviewers', () => undefined);
    vi.mocked(pickReviewers).mockResolvedValueOnce({ add: [user('carl'), group('Developers')], remove: [user('ana')] });
    const listed = review('ana');

    await chooseReviewers(inWs, listed);

    expect(vi.mocked(pickReviewers)).toHaveBeenLastCalledWith(listed);
    expect(fakeApi.calls().map(({ method, args }) => [method, ...args.slice(1)])).toEqual([
      ['codeReviews.addReviewers', 31, [user('carl'), group('Developers')]],
      ['codeReviews.removeReviewers', 31, [user('ana')]],
    ]);
  });

  it('changes nobody when the dialog is cancelled or nothing was picked', async () => {
    vi.mocked(pickReviewers).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ add: [], remove: [] });

    await chooseReviewers(inWs, review('ana'));
    await chooseReviewers(inWs, review('ana'));

    expect(fakeApi.methods()).toEqual([]);
  });

  it('renames a review with one call, reading only the reviews again', async () => {
    fakeApi.answer('codeReviews.rename', () => undefined);
    const refreshed = watchRefreshes(ws);

    expect(await renameReview(inWs, 31, 'Switching keeps changes')).toBe(true);

    expect(fakeApi.argsOf('codeReviews.rename')).toEqual([[inWs, 31, 'Switching keeps changes']]);
    expect(refreshed()).toEqual(['codeReviews']);
  });

  it('deletes the reviews picked in one call, and tells it did', async () => {
    fakeApi.answer('codeReviews.remove', () => undefined);

    expect(await deleteReviews(inWs, [review('ana', 1), review('ana', 2)])).toBe(true);

    expect(fakeApi.argsOf('codeReviews.remove')).toEqual([[inWs, [1, 2]]]);
  });

  it('refreshes only the reviews (their lists and the branch chips), never the history nor the workspace', async () => {
    workspaceOn('local');
    fakeApi.answer('accounts.list', () => []);
    fakeApi.answer('system.currentUser', () => 'ana');
    fakeApi.answer('codeReviews.setOwnStatus', () => undefined);
    fakeApi.answer('codeReviews.addReviewers', () => undefined);
    fakeApi.answer('codeReviews.remove', () => undefined);
    vi.mocked(pickReviewers).mockResolvedValueOnce({ add: [user('carl')], remove: [] });

    const afterStatus = watchRefreshes(ws);
    await setOwnReviewStatus(inWs, review('ana'), 'Reviewed');
    expect(afterStatus()).toEqual(['codeReviews']);

    const afterAdding = watchRefreshes(ws);
    await chooseReviewers(inWs, review('ana'));
    expect(afterAdding()).toEqual(['codeReviews']);

    const afterDelete = watchRefreshes(ws);
    await deleteReviews(inWs, [review('ana')]);
    expect(afterDelete()).toEqual(['codeReviews']);
  });

  it('tells a delete failed or was cancelled, so the selection stays', async () => {
    fakeApi.answer('codeReviews.remove', () => {
      throw new Error('Access denied');
    });
    expect(await deleteReviews(inWs, [review('ana')])).toBe(false);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't delete the review", detail: 'Access denied' }]);

    answerConfirms(false);
    expect(await deleteReviews(inWs, [review('ana')])).toBe(false);
    expect(fakeApi.argsOf('codeReviews.remove')).toHaveLength(1);
  });
});

describe('code reviews of a repository explored without a workspace', () => {
  it('deletes there, refreshing only its reviews', async () => {
    fakeApi.answer('codeReviews.remove', () => undefined);
    answerConfirms(true);
    const repository = repositoryPlace('game@local');
    const refreshed = watchRepositoryRefreshes('game@local');

    expect(await deleteReviews(repository, [review('ana', 1)])).toBe(true);

    expect(fakeApi.argsOf('codeReviews.remove')).toEqual([[repository, [1]]]);
    expect(refreshed()).toEqual(['codeReviews']);
  });
});
