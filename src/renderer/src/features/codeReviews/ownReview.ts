import type { CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import { isReviewer, ownStatus } from './reviewers';

/** What the page's "Your review" button reads: the status the user gave, or Review; and whether picking one adds them. */
export interface OwnReviewButtonState {
  label: string;
  status?: CodeReviewStatus;
  /** The user isn't a reviewer yet: setting a status adds them, which the popover says. */
  joining: boolean;
}

export function ownReviewButton(review: Pick<CodeReviewSummary, 'reviewers'>, user: string | undefined): OwnReviewButtonState {
  const status = ownStatus(review, user);
  if (status) return { label: status, status, joining: false };
  return { label: 'Review', joining: user !== undefined && !isReviewer(review, user) };
}
