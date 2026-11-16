import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CreateMergeRequestRequest } from '@shared/domain/codeReview';
import { workspacePlace } from '@shared/domain/place';
import { queryClient } from '../../app/queryClient';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { pressToastAction, shownToasts, watchRefreshes, whereTheWindowIs } from '../../testing/operationOutcome';
import { createMergeRequest } from './mergeRequestCreation';
import { branchReviewsKey } from './useCodeReviews';

const ws = '/ws';
const inWs = workspacePlace(ws);
const REQUEST: CreateMergeRequestRequest = { source: '/main/task1', destination: '/main', title: 'Task one', draft: false };

describe('creating a merge request', () => {
  it('asks once, reads the reviews again, says so and opens it from the toast', async () => {
    const refreshed = watchRefreshes(ws);
    fakeApi.answer('codeReviews.createMergeRequest', () => ({ id: 40, descriptionSaved: true }));

    expect(await createMergeRequest(inWs, REQUEST)).toBe(40);

    expect(fakeApi.argsOf('codeReviews.createMergeRequest')).toEqual([[inWs, REQUEST]]);
    expect(refreshed()).toEqual(['codeReviews']);
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Created merge request 40', action: 'Open' }]);
    pressToastAction('Created merge request 40');
    expect(whereTheWindowIs().pages.at(-1)).toEqual({ kind: 'codeReview', reviewId: 40 });
  });

  it('says when the request was made without its description', async () => {
    fakeApi.answer('codeReviews.createMergeRequest', () => ({ id: 41, descriptionSaved: false }));

    await createMergeRequest(inWs, { ...REQUEST, description: 'Why' });

    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Created merge request 41', detail: "Its description couldn't be saved.", action: 'Open' }]);
  });

  it('says what failed, and made nothing', async () => {
    fakeApi.answer('codeReviews.createMergeRequest', () => {
      throw new Error("The specified branch /main/nope can't be found.");
    });

    expect(await createMergeRequest(inWs, REQUEST)).toBeUndefined();

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't create the merge request", detail: "The specified branch /main/nope can't be found." }]);
  });

  // A server older than merge requests makes a plain code review of it, saying nothing: the read that follows tells.
  it('says so when the read that follows finds a plain code review, with no read of its own', async () => {
    fakeApi.answer('codeReviews.createMergeRequest', () => ({ id: 42, descriptionSaved: true }));

    await createMergeRequest(inWs, REQUEST);
    queryClient.setQueryData(branchReviewsKey(inWs, '/main/task1'), [codeReviewSummary({ id: 42 })]);

    expect(shownToasts().at(-1)).toEqual({ kind: 'info', title: "This server doesn't have merge requests yet", detail: '42 was created as a code review.' });
    expect(fakeApi.calls().map((call) => call.method)).toEqual(['codeReviews.createMergeRequest']);
  });

  it('says nothing more when the read finds the merge request', async () => {
    fakeApi.answer('codeReviews.createMergeRequest', () => ({ id: 43, descriptionSaved: true }));

    await createMergeRequest(inWs, REQUEST);
    queryClient.setQueryData(branchReviewsKey(inWs, '/main/task1'), [codeReviewSummary({ id: 43, mergeRequest: { state: 'Open', destination: '/main' } })]);

    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Created merge request 43', action: 'Open' }]);
  });
});
