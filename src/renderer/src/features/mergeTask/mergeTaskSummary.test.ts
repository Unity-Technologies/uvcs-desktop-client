import { describe, expect, it } from 'vitest';
import type { CodeReviewer } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { canMarkReviewed, defaultMergeComment, mergeRequestName } from './mergeTaskSummary';

describe('defaultMergeComment', () => {
  it('quotes the first line of the branch comment', () => {
    expect(defaultMergeComment({ name: '/main/t1', comment: 'Add the login screen\n\nDetails' })).toBe('Merge /main/t1: Add the login screen');
    expect(defaultMergeComment({ name: '/main/t1', comment: '' })).toBe('Merge /main/t1');
  });

  it("quotes a merge request's title over the branch comment", () => {
    expect(defaultMergeComment({ name: '/main/t1', comment: 'Add the login screen' }, { title: 'Add login\nwith SSO' })).toBe('Merge /main/t1: Add login');
  });
});

describe('mergeRequestName', () => {
  it('names the merge request by its number and title', () => {
    expect(mergeRequestName({ id: 12, title: 'Add login' })).toBe('Merge request 12 · Add login');
  });

  it("keeps only a title's first line", () => {
    expect(mergeRequestName({ id: 12, title: 'Add login\nwith SSO' })).toBe('Merge request 12 · Add login');
  });
});

describe('canMarkReviewed', () => {
  const review = (...reviewers: CodeReviewer[]) => codeReviewSummary({ id: 12, reviewers });

  it("offers the user's own review while they haven't marked it reviewed", () => {
    expect(canMarkReviewed(review({ name: 'bob', status: 'Under review' }), 'bob')).toBe(true);
    expect(canMarkReviewed(review({ name: 'bob', status: 'Rework required' }), 'bob')).toBe(true);
    expect(canMarkReviewed(review({ name: 'bob', status: 'Reviewed' }), 'bob')).toBe(false);
  });

  it("offers nothing to a user who isn't a reviewer, nor without a review", () => {
    expect(canMarkReviewed(review({ name: 'bob', status: 'Under review' }), 'eva')).toBe(false);
    expect(canMarkReviewed(review(), 'bob')).toBe(false);
    expect(canMarkReviewed(undefined, 'bob')).toBe(false);
  });
});
