import type { CodeReviewStatus, CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { listedVerdictOf } from './listedVerdict';
import { asMergeRequest } from './mergeRequestState';
import type { MergeVerdict } from './mergeVerdict';

/**
 * What the Merge requests list's Status column shows (`codeReviewColumns`): a merge request its verdict, the mark a
 * branch shows after its state (`listedVerdictOf`; the state leads the row as a glyph), a code review its review
 * status, all it has. The state is kept for sorting.
 */
export type ReviewStatusCell = { kind: 'mergeRequest'; state: MergeRequestState; verdict?: MergeVerdict } | { kind: 'codeReview'; status: CodeReviewStatus };

export function reviewStatusCellOf(review: CodeReviewSummary): ReviewStatusCell {
  const request = asMergeRequest(review);
  if (!request) return { kind: 'codeReview', status: review.status };
  const verdict = listedVerdictOf(request);
  return { kind: 'mergeRequest', state: request.mergeRequest.state, ...(verdict && { verdict }) };
}

const STATE_ORDER: Record<MergeRequestState, number> = { Open: 0, Draft: 1, Merged: 2, Closed: 3 };
const VERDICT_ORDER: Record<MergeVerdict | 'none', number> = { ready: 0, none: 1, blocked: 2 };

/**
 * How the Status column sorts: merge requests first, by state (Open, Draft, Merged, Closed), then by verdict (ready,
 * waiting, not ready); then code reviews by their status.
 */
export function reviewStatusSortValue(review: CodeReviewSummary): string {
  const cell = reviewStatusCellOf(review);
  if (cell.kind === 'codeReview') return `1-${cell.status}`;
  return `0-${STATE_ORDER[cell.state]}-${VERDICT_ORDER[cell.verdict ?? 'none']}`;
}
