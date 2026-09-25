import { describe, expect, it } from 'vitest';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { latestReviewByBranch } from './reviewsByBranch';

function review(id: number, targetBranchId?: number): CodeReviewSummary {
  return { id, title: `Review ${id}`, status: 'Under review', owner: 'jane', assignee: '', date: '2026-09-01', targetBranchId };
}

describe('latestReviewByBranch', () => {
  it('keeps the newest review of each branch, by branch id, and skips changeset reviews', () => {
    const reviews = [review(3, 31266319), review(2), review(1, 31266319), review(0, 31296513)];
    const byBranch = latestReviewByBranch(reviews);
    expect([...byBranch.keys()]).toEqual([31266319, 31296513]);
    expect(byBranch.get(31266319)?.id).toBe(3);
  });
});
