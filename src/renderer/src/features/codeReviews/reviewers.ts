import type { CodeReviewer, CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import { displayName } from '../../lib/userName';

/** How many reviewers a row shows before "+N". */
export const SHOWN_REVIEWERS = 3;

/** What a review's row shows of nobody asked to review it. */
export const NO_REVIEWERS = 'Nobody';

/**
 * The reviewers a row shows, how many more there are, and the name of a sole reviewer, which fits beside their avatar
 * (several show only avatars, named in the tooltip).
 */
export function shownReviewers(reviewers: readonly CodeReviewer[], max = SHOWN_REVIEWERS): { shown: CodeReviewer[]; more: number; soleName?: string } {
  const shown = reviewers.slice(0, max);
  return { shown, more: Math.max(0, reviewers.length - max), ...(reviewers.length === 1 && { soleName: displayName(reviewers[0]!.name) }) };
}

/** Each reviewer with the status they gave: what the row's tooltip and a screen reader say. */
export function reviewersText(reviewers: readonly CodeReviewer[]): string {
  return reviewers.length === 0 ? NO_REVIEWERS : reviewers.map((reviewer) => `${displayName(reviewer.name)}: ${reviewer.status}`).join(', ');
}

/**
 * Whether `user` is one of the review's reviewers by name, as `cm` writes both. Being a member of a reviewer group
 * isn't known here: the server lets a member set their status, and adds them as a reviewer when they do.
 */
export function isReviewer(review: Pick<CodeReviewSummary, 'reviewers'>, user: string | undefined): boolean {
  return reviewerNamed(review, user) !== undefined;
}

function reviewerNamed(review: Pick<CodeReviewSummary, 'reviewers'>, user: string | undefined): CodeReviewer | undefined {
  const name = user?.toLowerCase();
  return name ? review.reviewers.find((reviewer) => reviewer.name.toLowerCase() === name) : undefined;
}

/** The status `user` gave the review as one of its reviewers; none when they aren't one. */
export function ownStatus(review: Pick<CodeReviewSummary, 'reviewers'>, user: string | undefined): CodeReviewStatus | undefined {
  return reviewerNamed(review, user)?.status;
}

/**
 * Whether picking `status` as the user's own changes anything: not when it's the one they gave already. A user not
 * known yet, or not a reviewer, changes something with any pick.
 */
export function changesOwnStatus(review: Pick<CodeReviewSummary, 'reviewers'>, user: string | undefined, status: CodeReviewStatus): boolean {
  return ownStatus(review, user) !== status;
}

/** Names typed into one field, split at commas: `ana, bob` asks both. */
export function reviewerNames(typed: string): string[] {
  return [...new Set(typed.split(',').map((name) => name.trim()).filter(Boolean))];
}
