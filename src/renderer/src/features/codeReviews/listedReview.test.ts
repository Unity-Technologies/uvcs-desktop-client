import '../../testing/fakeWindow';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import type { CodeReview } from '@shared/domain/codeReview';
import { queryKeys } from '../../api/queryKeys';
import { createQueryClient } from '../../app/queryClient';
import { branchReviewKey } from './branchReviewKey';
import { listedReview, listedReviewIn, showMergeRequestChangedInListsIn, showReviewReadInListsIn, withMergeRequestChanged, withReviewRead, withStandingReviewUpdated } from './listedReview';

const review = (id: number, title: string): CodeReview => ({ ...codeReviewSummary({ id, title, owner: 'ana', date: '2026-10-01' }), target: { kind: 'branch', branch: '/main/task' } });

describe('listedReview', () => {
  it('finds the review in the newest list holding it', () => {
    const lists = [
      { data: [review(4, 'old title')], readAt: 100 },
      { data: [review(4, 'new title'), review(5, 'other')], readAt: 200 },
    ];

    expect(listedReview(lists, 4)).toEqual({ review: review(4, 'new title'), readAt: 200 });
  });

  it('skips summaries without the target, and what is not a list', () => {
    const summary = codeReviewSummary({ id: 4, title: 'chip', owner: 'ana', date: '2026-10-01' });

    expect(listedReview([{ data: [summary], readAt: 300 }, { data: review(4, 'single'), readAt: 400 }], 4)).toBeUndefined();
  });
});

describe('listedReviewIn', () => {
  const listKey = queryKeys.inWorkspace('/wk', 'codeReviews', { sinceDate: '2026-09-01' });

  it('finds the review in a list the cache holds', () => {
    const client = createQueryClient();
    client.setQueryData(listKey, [review(4, 'listed')]);

    expect(listedReviewIn(client, workspacePlace('/wk'), 4)?.review).toEqual(review(4, 'listed'));
  });

  it('never takes it from a list an operation marked stale and nobody read again', async () => {
    const client = createQueryClient();
    client.setQueryData(listKey, [review(4, 'old status')]);
    await client.invalidateQueries({ queryKey: queryKeys.inWorkspace('/wk', 'codeReviews') });

    expect(listedReviewIn(client, workspacePlace('/wk'), 4)).toBeUndefined();
  });
});

describe('withReviewRead', () => {
  const read: CodeReview = { ...review(4, 'renamed'), status: 'Reviewed', commentCount: 9 };

  it("puts the review read in its row, leaving the list's others as they were", () => {
    const list = [review(3, 'other'), review(4, 'old title')];

    expect(withReviewRead(list, read)).toEqual([review(3, 'other'), read]);
  });

  it("keeps what only a summary has, the branch chips' target branch id", () => {
    const summary = codeReviewSummary({ id: 4, title: 'chip', owner: 'ana', date: '2026-10-01', targetBranchId: 77 });

    expect(withReviewRead([summary], read)).toEqual([{ ...read, targetBranchId: 77 }]);
  });

  it('gives back what holds no row of it, or is no list, as it was', () => {
    const list = [review(3, 'other')];
    const reviewers = [{ name: 'ana', status: 'Pending' }];
    const single = review(4, 'single');

    expect(withReviewRead(list, read)).toBe(list);
    expect(withReviewRead(reviewers, read)).toBe(reviewers);
    expect(withReviewRead(single, read)).toBe(single);
  });
});

describe('showReviewReadInListsIn', () => {
  const place = workspacePlace('/wk');
  const listKey = queryKeys.inWorkspace('/wk', 'codeReviews', { sinceDate: '2026-09-01' });
  const read: CodeReview = { ...review(4, 'listed'), status: 'Rework required', commentCount: 12 };

  it('shows the review read in the lists holding it, each list as old as it was', () => {
    const client = createQueryClient();
    client.setQueryData(listKey, [review(4, 'listed'), review(5, 'other')], { updatedAt: 1_000 });

    showReviewReadInListsIn(client, place, read);

    expect(client.getQueryData(listKey)).toEqual([read, review(5, 'other')]);
    expect(client.getQueryState(listKey)?.dataUpdatedAt).toBe(1_000);
  });

  it('leaves a list an operation marked stale to its own read', async () => {
    const client = createQueryClient();
    client.setQueryData(listKey, [review(4, 'listed')]);
    await client.invalidateQueries({ queryKey: listKey });

    showReviewReadInListsIn(client, place, read);

    expect(client.getQueryData(listKey)).toEqual([review(4, 'listed')]);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  });
});

describe('withMergeRequestChanged', () => {
  const request = (id: number) => codeReviewSummary({ id, mergeRequest: { state: 'Open', destination: '/main' } });

  it("changes the listed merge request's state or destination, keeping the other rows as they were", () => {
    const rows = [request(43), request(44)];
    const changed = withMergeRequestChanged(rows, 43, { state: 'Closed' }) as typeof rows;

    expect(changed.map((row) => row.mergeRequest)).toEqual([{ state: 'Closed', destination: '/main' }, { state: 'Open', destination: '/main' }]);
    expect(changed[1]).toBe(rows[1]);
  });

  it("leaves alone what isn't a list holding it as a merge request", () => {
    const rows = [request(44), codeReviewSummary({ id: 45 })];
    expect(withMergeRequestChanged(rows, 43, { state: 'Closed' })).toBe(rows);
    expect(withMergeRequestChanged(rows, 45, { state: 'Closed' })).toBe(rows);
    expect(withMergeRequestChanged('read', 43, { state: 'Closed' })).toBe('read');
  });
});

describe("a branch's standing review, kept on its own", () => {
  const place = workspacePlace('/wk');
  const request = { ...codeReviewSummary({ id: 4, title: 'Login', targetBranchId: 37 }), mergeRequest: { state: 'Open' as const, destination: '/main' } };

  it('shows a merge request move at once, as the lists do', () => {
    const client = createQueryClient();
    client.setQueryData(branchReviewKey(place, 37), request);
    showMergeRequestChangedInListsIn(client, place, 4, { state: 'Closed' });
    expect(client.getQueryData(branchReviewKey(place, 37))).toEqual({ ...request, mergeRequest: { state: 'Closed', destination: '/main' } });
  });

  it('takes the review just read, keeping its branch id', () => {
    const client = createQueryClient();
    client.setQueryData(branchReviewKey(place, 37), request);
    showReviewReadInListsIn(client, place, { ...review(4, 'Login, renamed'), mergeRequest: request.mergeRequest });
    expect(client.getQueryData(branchReviewKey(place, 37))).toMatchObject({ title: 'Login, renamed', targetBranchId: 37 });
  });

  it('leaves another review, and a branch with none, as they were', () => {
    expect(withStandingReviewUpdated(request, 5, () => [])).toBe(request);
    expect(withStandingReviewUpdated(null, 4, () => [])).toBeNull();
  });
});
