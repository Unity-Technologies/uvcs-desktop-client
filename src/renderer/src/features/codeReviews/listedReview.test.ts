import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { queryKeys } from '../../api/queryKeys';
import { createQueryClient } from '../../app/queryClient';
import { listedReview, listedReviewIn } from './listedReview';

const review = (id: number, title: string): CodeReview => ({ id, title, status: 'Under review', owner: 'ana', assignee: 'bo', date: '2026-10-01', target: { kind: 'branch', branch: '/main/task' } });

describe('listedReview', () => {
  it('finds the review in the newest list holding it', () => {
    const lists = [
      { data: [review(4, 'old title')], readAt: 100 },
      { data: [review(4, 'new title'), review(5, 'other')], readAt: 200 },
    ];

    expect(listedReview(lists, 4)).toEqual({ review: review(4, 'new title'), readAt: 200 });
  });

  it('skips summaries without the target, and what is not a list', () => {
    const summary = { id: 4, title: 'chip', status: 'Under review', owner: 'ana', assignee: 'bo', date: '2026-10-01' };

    expect(listedReview([{ data: [summary], readAt: 300 }, { data: review(4, 'single'), readAt: 400 }], 4)).toBeUndefined();
  });
});

describe('listedReviewIn', () => {
  const listKey = queryKeys.inWorkspace('/wk', 'codeReviews', { sinceDate: '2026-09-01' });

  it('finds the review in a list the cache holds', () => {
    const client = createQueryClient();
    client.setQueryData(listKey, [review(4, 'listed')]);

    expect(listedReviewIn(client, '/wk', 4)?.review).toEqual(review(4, 'listed'));
  });

  it('never takes it from a list an operation marked stale and nobody read again', async () => {
    const client = createQueryClient();
    client.setQueryData(listKey, [review(4, 'old status')]);
    await client.invalidateQueries({ queryKey: queryKeys.inWorkspace('/wk', 'codeReviews') });

    expect(listedReviewIn(client, '/wk', 4)).toBeUndefined();
  });
});
