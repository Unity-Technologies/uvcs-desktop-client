import type { CodeReviewStatus, CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { listedVerdictOf } from './listedVerdict';
import { asMergeRequest } from './mergeRequestState';
import type { MergeVerdict } from './mergeVerdict';

/**
 * Where a review stands, as the Merge requests list (the icon after a row's title) and the details panel's header show
 * it: a merge request its state and its verdict, as by a branch (`listedVerdictOf`), a code review its review status,
 * all it has.
 */
export type ReviewStatusCell = { kind: 'mergeRequest'; state: MergeRequestState; verdict?: MergeVerdict } | { kind: 'codeReview'; status: CodeReviewStatus };

export function reviewStatusCellOf(review: CodeReviewSummary): ReviewStatusCell {
  const request = asMergeRequest(review);
  if (!request) return { kind: 'codeReview', status: review.status };
  const verdict = listedVerdictOf(request);
  return { kind: 'mergeRequest', state: request.mergeRequest.state, ...(verdict && { verdict }) };
}
