import { describe, expect, it } from 'vitest';
import { ownReviewButton } from './ownReview';

const review = { reviewers: [{ name: 'ana@acme.com', status: 'Rework required' as const }] };

describe('ownReviewButton', () => {
  it("reads the status a reviewer gave, in its icon's color", () => {
    expect(ownReviewButton(review, 'Ana@acme.com')).toEqual({ label: 'Rework required', status: 'Rework required', joining: false, preselected: 'Rework required' });
  });

  it("reads Review for someone who isn't a reviewer, whom a status adds", () => {
    expect(ownReviewButton(review, 'eva@acme.com')).toEqual({ label: 'Review', joining: true, preselected: 'Reviewed' });
  });

  it('reads Review, adding nobody, while who the user is is still read', () => {
    expect(ownReviewButton(review, undefined)).toEqual({ label: 'Review', joining: false, preselected: 'Reviewed' });
  });
});
