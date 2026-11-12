import type { CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import { isReviewer, ownStatus } from './reviewers';

/** What the page's "Your review" button reads: the status the user gave, or Review; and whether picking one adds them. */
export interface OwnReviewButtonState {
  label: string;
  status?: CodeReviewStatus;
  /** The user isn't a reviewer yet: setting a status adds them, which the popover says. */
  joining: boolean;
  /** The status the popover starts on: the one they gave, else Reviewed, what someone opening it most often gives. */
  preselected: CodeReviewStatus;
}

export function ownReviewButton(review: Pick<CodeReviewSummary, 'reviewers'>, user: string | undefined): OwnReviewButtonState {
  const status = ownStatus(review, user);
  if (status) return { label: status, status, joining: false, preselected: status };
  return { label: 'Review', joining: user !== undefined && !isReviewer(review, user), preselected: 'Reviewed' };
}

/**
 * What a status covers, said as it's picked: Reviewed and Rework required close the user's round, so what's checked in
 * later is new to them next time (docs/features/code-reviews.md "Rounds"). Only a branch's review says up to which
 * changeset (its newest); Under review closes nothing.
 */
export function statusCovers(status: CodeReviewStatus, newestChangeset: number | undefined): string | undefined {
  if (status === 'Under review' || newestChangeset === undefined) return undefined;
  return `Covers everything up to changeset ${newestChangeset}`;
}
