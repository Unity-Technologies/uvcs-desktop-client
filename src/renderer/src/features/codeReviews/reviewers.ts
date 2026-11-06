import type { CodeReviewer, CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import { displayName } from '../../lib/userName';
import type { StackedAvatar } from '../../ui/AvatarStack';

/** How many reviewers a row shows before "+N". */
export const SHOWN_REVIEWERS = 3;

/** What a review's row shows of nobody asked to review it. */
export const NO_REVIEWERS = 'Nobody';

/**
 * The reviewers a row shows, the rest it counts in "+N", and the name of a sole reviewer, which fits beside their
 * avatar (several show only avatars, each named in its own tooltip).
 */
export function shownReviewers(reviewers: readonly CodeReviewer[], max = SHOWN_REVIEWERS): { shown: CodeReviewer[]; rest: CodeReviewer[]; soleName?: string } {
  return {
    shown: reviewers.slice(0, max),
    rest: reviewers.slice(max),
    ...(reviewers.length === 1 && { soleName: displayName(reviewers[0]!.name) }),
  };
}

/** How big a reviewer's avatar is, in the list, the details and the review's page alike. */
export const REVIEWER_AVATAR_SIZE = 18;

/**
 * The Reviewers column's width: the stack of `SHOWN_REVIEWERS` avatars and "+N" spread, with their rings, inside the
 * cell's padding (`reviewersColumn.test.ts` holds it to that), or a sole reviewer's avatar and name.
 */
export const REVIEWERS_COLUMN_WIDTH = 130;

/**
 * The reviewers' stack: each shown reviewer's avatar, named with their status and ringed in its color, then a "+N"
 * disc naming the rest; a sole reviewer's name goes beside it.
 */
export function stackedReviewers(reviewers: readonly CodeReviewer[]): { avatars: StackedAvatar[]; more?: { count: number; tip: string }; soleName?: string } {
  const { shown, rest, soleName } = shownReviewers(reviewers);
  return {
    avatars: shown.map((reviewer) => ({ user: reviewer.name, tip: reviewerText(reviewer), ...ringOf(reviewer.status) })),
    ...(rest.length > 0 && { more: { count: rest.length, tip: reviewersText(rest) } }),
    ...(soleName && { soleName }),
  };
}

function ringOf(status: CodeReviewStatus): { ring?: string } {
  const ring = reviewerRing(status);
  return ring ? { ring } : {};
}

/** A reviewer with the status they gave: what their avatar's own tooltip says. */
export function reviewerText(reviewer: CodeReviewer): string {
  return `${displayName(reviewer.name)}: ${reviewer.status}`;
}

/** Each reviewer with the status they gave: what the row's tooltip, the "+N" one and a screen reader say. */
export function reviewersText(reviewers: readonly CodeReviewer[]): string {
  return reviewers.length === 0 ? NO_REVIEWERS : reviewers.map(reviewerText).join(', ');
}

/**
 * The color a reviewer's avatar is ringed in: the color of the status they gave, as `CodeReviewStatusBadge` shows it;
 * none while they review, the status every reviewer starts with.
 */
export function reviewerRing(status: CodeReviewStatus): string | undefined {
  return REVIEWER_RINGS[status];
}

const REVIEWER_RINGS: Record<CodeReviewStatus, string | undefined> = {
  'Under review': undefined,
  Reviewed: 'var(--status-added)',
  'Rework required': 'var(--status-changed)',
};

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
