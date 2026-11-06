import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../../ui/dialog/prompt', () => import('../../testing/fakeDialogs'));

import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { answerConfirms, answerPrompts, askedDialogs } from '../../testing/fakeDialogs';
import { shownToasts, watchRefreshes, watchRepositoryRefreshes } from '../../testing/operationOutcome';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { addReviewers, deleteReviews, renameReview, setOwnReviewStatus } from './codeReviewOperations';

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
      ['codeReviews.addReviewers', 31, ['eva']],
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

    await setOwnReviewStatus(inWs, review('ana'), 'Rework required', 'ana');

    expect(fakeApi.methods()).toEqual(['codeReviews.setOwnStatus']);
  });

  it("changes nothing when a user who isn't a reviewer declines", async () => {
    signedInAs('eva');
    answerConfirms(false);

    await setOwnReviewStatus(inWs, review('ana'), 'Reviewed');

    expect(fakeApi.methods()).toEqual(['accounts.list', 'system.currentUser']);
  });
});

describe('review operations', () => {
  it('adds every reviewer typed, separated by commas, in one call', async () => {
    fakeApi.answer('codeReviews.addReviewers', () => undefined);
    answerPrompts('carl, dana');

    await addReviewers(inWs, review('ana'));

    expect(fakeApi.argsOf('codeReviews.addReviewers')).toEqual([[inWs, 31, ['carl', 'dana']]]);
  });

  it('adds nobody when the prompt is cancelled or left empty', async () => {
    answerPrompts(' , ');

    await addReviewers(inWs, review('ana'));
    await addReviewers(inWs, review('ana'));

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
    answerPrompts('carl');

    const afterStatus = watchRefreshes(ws);
    await setOwnReviewStatus(inWs, review('ana'), 'Reviewed');
    expect(afterStatus()).toEqual(['codeReviews']);

    const afterAdding = watchRefreshes(ws);
    await addReviewers(inWs, review('ana'));
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
