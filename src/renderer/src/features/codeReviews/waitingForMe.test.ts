import { describe, expect, it } from 'vitest';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { waitingForMe, waitingForMeTip } from './waitingForMe';

describe('whether a review waits for the user', () => {
  it('waits for a reviewer whose own status is Under review, whatever the review as a whole says', () => {
    const review = codeReviewSummary({
      id: 1,
      status: 'Rework required',
      reviewers: [
        { name: 'zoe', status: 'Rework required' },
        { name: 'Ana', status: 'Under review' },
      ],
    });
    expect(waitingForMe(review, 'ana')).toEqual({ kind: 'review' });
  });

  it("doesn't wait for a reviewer who gave their status already", () => {
    const review = codeReviewSummary({ id: 2, reviewers: [{ name: 'ana', status: 'Reviewed' }] });
    expect(waitingForMe(review, 'ana')).toBeUndefined();
  });

  it('waits for the author of a review in Rework required with change requests or questions open', () => {
    const review = codeReviewSummary({ id: 3, owner: 'ana', status: 'Rework required', openIssueCount: 3, reviewers: [{ name: 'zoe', status: 'Rework required' }] });
    expect(waitingForMe(review, 'ANA')).toEqual({ kind: 'rework', openIssues: 3 });
  });

  it("doesn't wait for the author once nothing is open, or while the review isn't in Rework required", () => {
    expect(waitingForMe(codeReviewSummary({ id: 4, owner: 'ana', status: 'Rework required', openIssueCount: 0 }), 'ana')).toBeUndefined();
    expect(waitingForMe(codeReviewSummary({ id: 5, owner: 'ana', status: 'Under review', openIssueCount: 2 }), 'ana')).toBeUndefined();
  });

  it('waits on neither for someone else, nor while the user is unknown', () => {
    const review = codeReviewSummary({ id: 6, owner: 'ana', status: 'Rework required', openIssueCount: 1, reviewers: [{ name: 'zoe', status: 'Under review' }] });
    expect(waitingForMe(review, 'bob')).toBeUndefined();
    expect(waitingForMe(review, undefined)).toBeUndefined();
  });

  it("doesn't tell a group the user may belong to: only a reviewer named as the user waits", () => {
    const review = codeReviewSummary({ id: 7, reviewers: [{ name: 'qa-team', status: 'Under review' }] });
    expect(waitingForMe(review, 'ana')).toBeUndefined();
  });
});

describe('what the waiting dot says', () => {
  it('asks a reviewer for their review, and tells the author how much is open', () => {
    expect(waitingForMeTip({ kind: 'review' })).toBe('Waiting for your review');
    expect(waitingForMeTip({ kind: 'rework', openIssues: 3 })).toBe('Rework: 3 open');
    expect(waitingForMeTip({ kind: 'rework', openIssues: 1 })).toBe('Rework: 1 open');
  });
});
