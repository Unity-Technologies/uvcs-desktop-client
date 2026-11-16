import type { CodeReviewStatus, CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { commentLineText } from '../../lib/comments/commentText';

/** What a branch's review chip shows (`CodeReviewChip`): the state of a merge request, the review's status, its tooltip. */
export interface ReviewChip {
  /** The merge request's state glyph, leading. */
  state?: MergeRequestState;
  /** The review status's glyph. */
  status?: CodeReviewStatus;
  /** Whether the status is written beside its glyph ("In review"). */
  statusText: boolean;
  tip: string;
  tipSub: string;
  /** What a screen reader says it does. */
  label: string;
}

/**
 * A branch's review chip. A code review shows its status; a merge request leads it with its state ("⌥ In review").
 * Narrow (`iconOnly`), a merge request shows its state until it is Open and reviewed, then the thumbs-up alone: at a
 * glance, whether it can merge.
 */
export function reviewChipOf(review: CodeReviewSummary, iconOnly: boolean): ReviewChip {
  const { mergeRequest, status } = review;
  const title = commentLineText(review.title);
  const noun = mergeRequest ? 'merge request' : 'code review';
  const readyToMerge = mergeRequest?.state === 'Open' && status === 'Reviewed';
  const showsState = mergeRequest !== undefined && !(iconOnly && readyToMerge);
  return {
    state: showsState ? mergeRequest.state : undefined,
    status: iconOnly && showsState ? undefined : status,
    statusText: !iconOnly,
    tip: iconOnly ? `${status}: ${title}` : title,
    tipSub: `${reviewLine(review)} · click to open`,
    label: `Open ${noun} ${review.id}: ${title}`,
  };
}

/** What it is and where it stands, in one line: "Merge request 12 · Open into /main · Under review". */
export function reviewLine({ id, status, mergeRequest }: CodeReviewSummary): string {
  return mergeRequest ? `Merge request ${id} · ${mergeRequest.state} into ${mergeRequest.destination} · ${status}` : `Code review ${id} · ${status}`;
}
