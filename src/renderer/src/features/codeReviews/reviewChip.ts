import type { CodeReviewStatus, CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { commentLineText } from '../../lib/comments/commentText';
import { listedVerdictOf } from './listedVerdict';
import { asMergeRequest, type MergeRequestReview } from './mergeRequestState';
import type { MergeVerdict } from './mergeVerdict';

/** What a branch's review chip shows (`CodeReviewChip`, the Branch Explorer's `drawReviewChip`) and how it's named. */
export interface ReviewChip {
  /** The merge request's state glyph, leading. */
  state?: MergeRequestState;
  /** Whether the state's name is written beside its glyph ("Open"). */
  stateText: boolean;
  /** A merge request's verdict after its pill (`listedVerdictOf`): whether it can merge, a check or a cross. */
  verdict?: MergeVerdict;
  /** A code review's status, its badge. */
  status?: CodeReviewStatus;
  /** Whether the status is written beside its glyph ("In review"). */
  statusText: boolean;
  /** What hovering it shows: a merge request's summary card (`MergeRequestSummaryCard`), a code review's tooltip. */
  hover: { kind: 'summary'; request: MergeRequestReview } | { kind: 'tip'; tip: string; tipSub: string };
  /** What a screen reader says it does. */
  label: string;
}

/**
 * A branch's review chip. A merge request names its state ("Open", in its color), then its verdict, whether it can
 * merge (`listedVerdictOf`: a check, a cross; none while it waits), as its card's discs say it section by section; what
 * decides it (the review's icon) shows on hover. Never its number: the branch already names the work
 * (merge-requests.md "Its number"). A code review shows its status. Narrow (`iconOnly`), the names go and the glyphs
 * stay.
 */
export function reviewChipOf(review: CodeReviewSummary, iconOnly: boolean): ReviewChip {
  const { status } = review;
  const title = commentLineText(review.title);
  const request = asMergeRequest(review);
  if (request) {
    const { state } = request.mergeRequest;
    return {
      state,
      stateText: !iconOnly,
      verdict: listedVerdictOf(request),
      statusText: false,
      hover: { kind: 'summary', request },
      label: `Open merge request: ${title}`,
    };
  }
  return {
    stateText: false,
    status,
    statusText: !iconOnly,
    hover: { kind: 'tip', tip: iconOnly ? `${status}: ${title}` : title, tipSub: `${codeReviewLine(review)} · click to open` },
    label: `Open code review ${review.id}: ${title}`,
  };
}

/** A code review in one line, what it is and where it stands: "Code review 12 · Reviewed". */
export function codeReviewLine({ id, status }: Pick<CodeReviewSummary, 'id' | 'status'>): string {
  return `Code review ${id} · ${status}`;
}
