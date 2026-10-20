import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { listedReview } from './listedReview';

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
