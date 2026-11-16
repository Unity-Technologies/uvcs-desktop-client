import '../../testing/fakeWindow';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';
import { codeReviewKey } from './codeReviewKey';
import { onFirstReadOfReview } from './firstReadOfReview';
import { branchReviewsKey, reviewSummariesKey } from './useCodeReviews';

const PLACE = workspacePlace('/wk/game');

function review(id: number, mergeRequest?: CodeReviewSummary['mergeRequest']): CodeReviewSummary {
  return {
    id,
    title: `Review ${id}`,
    status: 'Under review',
    owner: 'ana',
    reviewers: [],
    date: '2026-11-10T10:00:00Z',
    lastActivity: '2026-11-10T10:00:00Z',
    commentCount: 0,
    openIssueCount: 0,
    ...(mergeRequest && { mergeRequest }),
  };
}

describe('onFirstReadOfReview', () => {
  it("hands over the review from the first read of the place's reviews that holds it, once", () => {
    const client = new QueryClient();
    const onRead = vi.fn();
    onFirstReadOfReview(client, PLACE, 40, onRead);

    client.setQueryData(branchReviewsKey(PLACE, '/main/task'), [review(39)]);
    expect(onRead).not.toHaveBeenCalled();

    const created = review(40, { state: 'Open', destination: '/main' });
    client.setQueryData(branchReviewsKey(PLACE, '/main/task'), [created, review(39)]);
    client.setQueryData(reviewSummariesKey(PLACE), [created]);

    expect(onRead.mock.calls).toEqual([[created]]);
  });

  it("finds it in a review's own read, its page's", () => {
    const client = new QueryClient();
    const onRead = vi.fn();
    onFirstReadOfReview(client, PLACE, 40, onRead);

    client.setQueryData(codeReviewKey(PLACE, 40), review(40));

    expect(onRead.mock.calls).toEqual([[review(40)]]);
  });

  it("ignores another place's reads and other areas", () => {
    const client = new QueryClient();
    const onRead = vi.fn();
    onFirstReadOfReview(client, PLACE, 40, onRead);

    client.setQueryData(branchReviewsKey(repositoryPlace('game@local'), '/main/task'), [review(40)]);
    client.setQueryData(queryKeys.inPlace(PLACE, 'branches', 'byName', '/main/task'), [review(40)]);

    expect(onRead).not.toHaveBeenCalled();
  });

  it('stops watching when asked', () => {
    const client = new QueryClient();
    const onRead = vi.fn();
    const stop = onFirstReadOfReview(client, PLACE, 40, onRead);

    stop();
    client.setQueryData(reviewSummariesKey(PLACE), [review(40)]);

    expect(onRead).not.toHaveBeenCalled();
  });
});
