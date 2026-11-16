import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { sameUser } from '../../lib/userName';
import { formatCount } from '../../lib/text';
import type { NavBadge } from '../../ui/nav/navBadgeText';
import { isActiveMergeRequest } from './mergeRequestState';
import { ownStatus } from './reviewers';

/** Why a review waits for the user: their review as a reviewer, or their rework as its author. */
export type WaitingForMe = { kind: 'review' } | { kind: 'rework'; openIssues: number };

/**
 * Whether the review waits for `user`, from the list's own fields: they are a reviewer whose status is still Under
 * review (of a code review, or a merge request that is Open), or they wrote it and it's in Rework required with change requests or questions open (a code review, or a merge
 * request Open or Draft). A reviewer is matched
 * by name only: a group the user belongs to can't be told from `cm find review`'s names (`isReviewer`), and a command
 * per row to read its members would cost the server more than the dot is worth. Nor can the list tell a reviewer asked
 * again from one who never looked: both are Under review.
 */
export function waitingForMe(review: WaitingFields, user: string | undefined): WaitingForMe | undefined {
  if (!user) return undefined;
  if (asksForReviews(review) && ownStatus(review, user) === 'Under review') return { kind: 'review' };
  if (asksForRework(review) && sameUser(review.owner, user) && review.status === 'Rework required' && review.openIssueCount > 0) return { kind: 'rework', openIssues: review.openIssueCount };
  return undefined;
}

type WaitingFields = Pick<CodeReviewSummary, 'owner' | 'status' | 'reviewers' | 'openIssueCount' | 'mergeRequest'>;

/** A code review asks its reviewers; a merge request only once Open: a draft isn't ready, a merged or closed one is done. */
function asksForReviews(review: WaitingFields): boolean {
  return !review.mergeRequest || review.mergeRequest.state === 'Open';
}

/** A code review's rework is its author's to do; a merge request's while still to merge (Open or Draft). */
function asksForRework(review: WaitingFields): boolean {
  return !review.mergeRequest || isActiveMergeRequest(review);
}

/** How many of the reviews read wait for the user: Waiting for me and the sidebar count them. */
export function waitingCount(reviews: readonly WaitingFields[], user: string | undefined): number {
  return reviews.filter((review) => waitingForMe(review, user) !== undefined).length;
}

/** The waiting dot's tooltip. */
export function waitingForMeTip(waiting: WaitingForMe): string {
  return waiting.kind === 'review' ? 'Waiting for your review' : `Rework: ${formatCount(waiting.openIssues)} open`;
}

/** The sidebar's count on Code reviews: the reviews read that wait for the user; none when none does, or none was read. */
export function waitingBadge(reviews: readonly WaitingFields[] | undefined, user: string | undefined): NavBadge | undefined {
  const count = reviews ? waitingCount(reviews, user) : 0;
  return count > 0 ? { count } : undefined;
}
