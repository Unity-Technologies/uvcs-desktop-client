import { describe, expect, it } from 'vitest';
import type { CodeReview, CodeReviewTarget } from '@shared/domain/codeReview';
import { latestReviewByBranch } from './reviewsByBranch';

function review(id: number, target: CodeReviewTarget): CodeReview {
  return { id, title: `Review ${id}`, status: 'Under review', owner: 'jane', assignee: '', date: '2026-09-01', target };
}

describe('latestReviewByBranch', () => {
  it('keeps the newest review of each branch and skips changeset reviews', () => {
    const reviews = [
      review(3, { kind: 'branch', branch: '/main/a' }),
      review(2, { kind: 'changeset', changesetId: 5 }),
      review(1, { kind: 'branch', branch: '/main/a' }),
      review(0, { kind: 'branch', branch: '/main/b' }),
    ];
    const byBranch = latestReviewByBranch(reviews);
    expect([...byBranch.keys()]).toEqual(['/main/a', '/main/b']);
    expect(byBranch.get('/main/a')?.id).toBe(3);
  });
});
