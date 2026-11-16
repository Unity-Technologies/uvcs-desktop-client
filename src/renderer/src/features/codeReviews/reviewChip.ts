import type { CodeReviewStatus, CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { commentLineText } from '../../lib/comments/commentText';

/** What a branch's review chip shows (`CodeReviewChip`, the Branch Explorer's `drawReviewChip`) and how it's named. */
export interface ReviewChip {
  /** The merge request's state glyph, leading. */
  state?: MergeRequestState;
  /** Whether the state's name is written beside its glyph ("Open"). */
  stateText: boolean;
  /** The review status's glyph. */
  status?: CodeReviewStatus;
  /** Whether the status is written beside its glyph ("In review"). */
  statusText: boolean;
  /** A code review's tooltip; a merge request shows its summary card on hover instead (`MergeRequestSummaryCard`). */
  tip?: string;
  tipSub?: string;
  /** What a screen reader says it does. */
  label: string;
}

/**
 * A branch's review chip. A merge request names its state ("Open", in its color), then, while Open and once its
 * review is decided, a check (reviewed) or a cross (changes required): at a glance, where it stands and whether it can
 * merge; "Open" alone says it waits for its review. Never its number: the branch already
 * names the work (merge-requests.md "Its number"). A code review shows its status. Narrow (`iconOnly`), the names go
 * and the glyphs stay.
 */
export function reviewChipOf(review: CodeReviewSummary, iconOnly: boolean): ReviewChip {
  const { mergeRequest, status } = review;
  const title = commentLineText(review.title);
  if (mergeRequest) {
    return {
      state: mergeRequest.state,
      stateText: !iconOnly,
      status: mergeRequest.state === 'Open' && status !== 'Under review' ? status : undefined,
      statusText: false,
      label: `Open merge request: ${title}`,
    };
  }
  return {
    stateText: false,
    status,
    statusText: !iconOnly,
    tip: iconOnly ? `${status}: ${title}` : title,
    tipSub: `${reviewLine(review)} · click to open`,
    label: `Open code review ${review.id}: ${title}`,
  };
}

/** What it is and where it stands, in one line: "Merge request · Open into /main · Under review", "Code review 12 · Reviewed". */
export function reviewLine({ id, status, mergeRequest }: CodeReviewSummary): string {
  return mergeRequest ? `Merge request · ${mergeRequest.state} into ${mergeRequest.destination} · ${status}` : `Code review ${id} · ${status}`;
}
