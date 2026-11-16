import type { CodeReviewStatus, CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { commentLineText } from '../../lib/comments/commentText';
import { asMergeRequest, type MergeRequestReview } from './mergeRequestState';

/** What a branch's review chip shows (`CodeReviewChip`, the Branch Explorer's `drawReviewChip`) and how it's named. */
export interface ReviewChip {
  /** The merge request's state glyph, leading. */
  state?: MergeRequestState;
  /** Whether the state's name is written beside its glyph ("Open"). */
  stateText: boolean;
  /** The review status's glyph. */
  status?: CodeReviewStatus;
  /**
   * How the status shows: a badge, its name beside its glyph where `statusText` (a code review's), or the bare icon
   * after a merge request's state.
   */
  statusForm: 'badge' | 'icon';
  /** Whether the status is written beside its glyph ("In review"). */
  statusText: boolean;
  /** What hovering it shows: a merge request's summary card (`MergeRequestSummaryCard`), a code review's tooltip. */
  hover: { kind: 'summary'; request: MergeRequestReview } | { kind: 'tip'; tip: string; tipSub: string };
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
  const { status } = review;
  const title = commentLineText(review.title);
  const request = asMergeRequest(review);
  if (request) {
    const { state } = request.mergeRequest;
    return {
      state,
      stateText: !iconOnly,
      status: state === 'Open' && status !== 'Under review' ? status : undefined,
      statusForm: 'icon',
      statusText: false,
      hover: { kind: 'summary', request },
      label: `Open merge request: ${title}`,
    };
  }
  return {
    stateText: false,
    status,
    statusForm: 'badge',
    statusText: !iconOnly,
    hover: { kind: 'tip', tip: iconOnly ? `${status}: ${title}` : title, tipSub: `${codeReviewLine(review)} · click to open` },
    label: `Open code review ${review.id}: ${title}`,
  };
}

/** A code review in one line, what it is and where it stands: "Code review 12 · Reviewed". */
export function codeReviewLine({ id, status }: Pick<CodeReviewSummary, 'id' | 'status'>): string {
  return `Code review ${id} · ${status}`;
}
