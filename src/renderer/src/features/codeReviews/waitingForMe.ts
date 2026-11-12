import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { sameUser } from '../../lib/userName';
import { formatCount } from '../../lib/text';
import { ownStatus } from './reviewers';

/** Why a review waits for the user: their review as a reviewer, or their rework as its author. */
export type WaitingForMe = { kind: 'review' } | { kind: 'rework'; openIssues: number };

/**
 * Whether the review waits for `user`, from the list's own fields: they are a reviewer whose status is still Under
 * review, or they wrote it and it's in Rework required with change requests or questions open. A reviewer is matched
 * by name only: a group the user belongs to can't be told from `cm find review`'s names (`isReviewer`), and a command
 * per row to read its members would cost the server more than the dot is worth. Nor can the list tell a reviewer asked
 * again from one who never looked: both are Under review.
 */
export function waitingForMe(review: Pick<CodeReviewSummary, 'owner' | 'status' | 'reviewers' | 'openIssueCount'>, user: string | undefined): WaitingForMe | undefined {
  if (!user) return undefined;
  if (ownStatus(review, user) === 'Under review') return { kind: 'review' };
  if (sameUser(review.owner, user) && review.status === 'Rework required' && review.openIssueCount > 0) return { kind: 'rework', openIssues: review.openIssueCount };
  return undefined;
}

/** The waiting dot's tooltip. */
export function waitingForMeTip(waiting: WaitingForMe): string {
  return waiting.kind === 'review' ? 'Waiting for your review' : `Rework: ${formatCount(waiting.openIssues)} open`;
}
