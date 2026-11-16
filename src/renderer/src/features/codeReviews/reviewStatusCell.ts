import type { CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import { listedVerdictOf } from './listedVerdict';
import { asMergeRequest } from './mergeRequestState';
import type { MergeVerdict } from './mergeVerdict';

/**
 * The icon after a row's title in the Merge requests list (`codeReviewColumns`): a merge request its verdict, the
 * mark a branch shows after its state (`listedVerdictOf`; the state leads the row as a glyph), a code review its review
 * status, all it has.
 */
export type ReviewStatusCell = { kind: 'mergeRequest'; verdict?: MergeVerdict } | { kind: 'codeReview'; status: CodeReviewStatus };

export function reviewStatusCellOf(review: CodeReviewSummary): ReviewStatusCell {
  const request = asMergeRequest(review);
  if (!request) return { kind: 'codeReview', status: review.status };
  const verdict = listedVerdictOf(request);
  return { kind: 'mergeRequest', ...(verdict && { verdict }) };
}
