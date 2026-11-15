import type { CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import type { OwnReviewPick } from './ownReviewChoiceStore';
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
 * The status the popover shows picked: the one the user picked and didn't send yet (`useOwnReviewChoiceStore`), else
 * the preselected one. A pick made over a status that has since changed elsewhere (the review's menu, another window)
 * is dropped: the popover shows what they have now.
 */
export function ownReviewChoice(button: OwnReviewButtonState, picked: OwnReviewPick | undefined): CodeReviewStatus {
  return picked && picked.over === button.preselected ? picked.status : button.preselected;
}

