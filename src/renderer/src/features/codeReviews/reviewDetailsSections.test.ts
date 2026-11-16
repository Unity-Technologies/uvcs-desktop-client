// The review section's words come with the merge card's, whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReview, CodeReviewTarget, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { reviewDetailsSections } from './reviewDetailsSections';

const ANA = { name: 'ana', status: 'Reviewed' as const };
const ON_TASK: CodeReviewTarget = { kind: 'branch', branch: '/main/task' };

function review(target: CodeReviewTarget, state?: MergeRequestState): CodeReview {
  return { ...codeReviewSummary({ id: 12, status: 'Reviewed', reviewers: [ANA] }), target, ...(state && { mergeRequest: { state, destination: '/main' } }) };
}

describe('reviewDetailsSections', () => {
  it("shows an Open merge request's review standing, its reviewers and its branch's attributes", () => {
    expect(reviewDetailsSections(review(ON_TASK, 'Open'))).toEqual({
      review: { tone: 'passed', status: 'Reviewed', title: 'Changes reviewed', detail: '1 approving review' },
      branchAttributes: 'br:/main/task',
    });
  });

  it("leaves out the review standing where a merge request's summary does: a draft, a closed one", () => {
    expect(reviewDetailsSections(review(ON_TASK, 'Draft')).review).toBeUndefined();
    expect(reviewDetailsSections(review(ON_TASK, 'Closed')).review).toBeUndefined();
  });

  it("shows a code review of a branch with its branch's attributes, and no review standing: its status badge says it", () => {
    expect(reviewDetailsSections(review(ON_TASK))).toEqual({ branchAttributes: 'br:/main/task' });
  });

  it('shows no attributes for a review of a changeset or a shelve: no branch is reviewed', () => {
    expect(reviewDetailsSections(review({ kind: 'changeset', changesetId: 4 }))).toEqual({});
    expect(reviewDetailsSections(review({ kind: 'shelve', shelveId: 2 }))).toEqual({});
  });
});
