import type { CodeReview } from '@shared/domain/codeReview';
import { spec } from '@shared/domain/specs';
import { mergeRequestSummaryOf, type MergeRequestSummary } from './mergeRequestSummary';

/**
 * The sections a selected review's details panel shows under its heading (`CodeReviewDetails`), besides its
 * reviewers, always listed: where a merge request's review stands, as its summary says it (`mergeRequestSummaryOf`),
 * and the reviewed branch's attributes, to read and edit them where the work is reviewed (a changeset or a shelve has
 * none to show here).
 */
export interface ReviewDetailsSections {
  review?: MergeRequestSummary['review'];
  /** The branch's spec, whose attributes show (`AttributesDetailsSection`). */
  branchAttributes?: string;
}

export function reviewDetailsSections(review: CodeReview): ReviewDetailsSections {
  const standing = review.mergeRequest ? mergeRequestSummaryOf({ ...review, mergeRequest: review.mergeRequest }).review : undefined;
  return {
    ...(standing && { review: standing }),
    ...(review.target.kind === 'branch' && { branchAttributes: spec.branch(review.target.branch) }),
  };
}
