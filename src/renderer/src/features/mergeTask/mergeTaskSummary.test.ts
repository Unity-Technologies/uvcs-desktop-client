import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { canMarkReviewed, defaultMergeComment } from './mergeTaskSummary';

describe('defaultMergeComment', () => {
  it('quotes the first line of the branch comment', () => {
    expect(defaultMergeComment({ name: '/main/t1', comment: 'Add the login screen\n\nDetails' })).toBe('Merge /main/t1: Add the login screen');
    expect(defaultMergeComment({ name: '/main/t1', comment: '' })).toBe('Merge /main/t1');
  });
});

describe('canMarkReviewed', () => {
  const review = (status: CodeReview['status']) => ({ status }) as CodeReview;

  it('only offers reviews not reviewed yet', () => {
    expect(canMarkReviewed(review('Under review'))).toBe(true);
    expect(canMarkReviewed(review('Rework required'))).toBe(true);
    expect(canMarkReviewed(review('Reviewed'))).toBe(false);
    expect(canMarkReviewed(undefined)).toBe(false);
  });
});
