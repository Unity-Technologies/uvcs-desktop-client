import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryObserver, type QueryClient } from '@tanstack/react-query';
import type { CodeReview, CodeReviewSummary } from '@shared/domain/codeReview';
import { workspacePlace } from '@shared/domain/place';
import { createQueryClient, invalidatePlaceIn, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { isAffectedByCheckinOrUpdate, isAffectedByCodeReviews } from '../../app/refresh/refreshScopes';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { namedReviewListQuery, reviewListSummariesQuery } from './reviewListQueries';

const place = workspacePlace('/ws');
const FILTER = { sinceDate: '2026-08-24' };
const ON_TASK = codeReviewSummary({ id: 5, targetBranchId: 37 });
const ON_CHANGESET = codeReviewSummary({ id: 6, target: { kind: 'changeset', changesetId: 120 } });

let client: QueryClient;

beforeEach(() => {
  vi.useFakeTimers();
  client = createQueryClient();
});

afterEach(() => {
  client.clear();
  vi.useRealTimers();
});

function answerReviews(reviews: CodeReviewSummary[] = [ON_TASK, ON_CHANGESET]): void {
  fakeApi.answer('codeReviews.listSummaries', () => reviews);
  fakeApi.answer('codeReviews.branchNames', () => ({ 37: '/main/task1' }));
}

/** The sidebar's count on screen, as `useWaitingForMeBadge` observes the summaries; settles once its read ends. */
async function showCount(): Promise<QueryObserver<CodeReviewSummary[]>> {
  return show(new QueryObserver(client, { ...reviewListSummariesQuery(place, FILTER), ...SLOW_CHANGING_QUERY }));
}

/** The Merge requests view on screen, as `useCodeReviews` observes its list; settles once its read ends. */
async function showView(): Promise<QueryObserver<CodeReview[]>> {
  return show(new QueryObserver(client, namedReviewListQuery(client, place, FILTER)));
}

/** Subscribes `observer`, as a mounted `useQuery`, and awaits the read it starts, if any. */
async function show<Data>(observer: QueryObserver<Data>): Promise<QueryObserver<Data>> {
  observer.subscribe(() => {});
  await client.getQueryCache().find({ queryKey: observer.options.queryKey, exact: true })?.promise;
  return observer;
}

const reads = (method: string) => fakeApi.argsOf(method).length;

describe('the reviews the sidebar counts and the Merge requests view shows', () => {
  it('counts from the reviews alone, asking for no branch name', async () => {
    answerReviews();

    const count = await showCount();

    expect(count.getCurrentResult().data).toEqual([ON_TASK, ON_CHANGESET]);
    expect(fakeApi.methods()).toEqual(['codeReviews.listSummaries']);
    expect(fakeApi.argsOf('codeReviews.listSummaries')).toEqual([[place, FILTER]]);
  });

  it("names the count's reviews when the view opens while they are fresh, reading them no second time", async () => {
    answerReviews();
    await showCount();
    vi.advanceTimersByTime(20_000);

    const view = await showView();

    expect(view.getCurrentResult().data).toEqual([
      { ...ON_TASK, target: { kind: 'branch', branch: '/main/task1' } },
      ON_CHANGESET,
    ]);
    expect(fakeApi.methods()).toEqual(['codeReviews.listSummaries', 'codeReviews.branchNames']);
    expect(fakeApi.argsOf('codeReviews.branchNames')).toEqual([[place, [37]]]);
  });

  it('reads the reviews again when the view opens past its own staleness, and the count shows that read', async () => {
    answerReviews();
    const count = await showCount();
    vi.advanceTimersByTime(31_000);
    const newer = codeReviewSummary({ id: 9, targetBranchId: 37 });
    answerReviews([newer, ON_TASK]);

    await showView();

    expect(reads('codeReviews.listSummaries')).toBe(2);
    expect(count.getCurrentResult().data).toEqual([newer, ON_TASK]);
  });

  it('asks for no branch name when no review targets a branch', async () => {
    answerReviews([ON_CHANGESET]);

    await showView();

    expect(fakeApi.methods()).toEqual(['codeReviews.listSummaries']);
  });

  it('reads the reviews once on a refresh with the count and the view on screen, whichever showed first', async () => {
    answerReviews();
    await showView();
    await showCount();

    await invalidatePlaceIn(client, place, isAffectedByCodeReviews);

    expect([reads('codeReviews.listSummaries'), reads('codeReviews.branchNames')]).toEqual([2, 2]);
  });

  it('reads the reviews once on a refresh with the count shown first, then the view', async () => {
    answerReviews();
    await showCount();
    await showView();

    await invalidatePlaceIn(client, place, isAffectedByCodeReviews);

    expect([reads('codeReviews.listSummaries'), reads('codeReviews.branchNames')]).toEqual([2, 2]);
  });

  it('are read again on a write on a review, never on a check-in', () => {
    const { queryKey } = reviewListSummariesQuery(place, FILTER);
    expect([isAffectedByCodeReviews(queryKey), isAffectedByCheckinOrUpdate(queryKey)]).toEqual([true, false]);
  });
});
