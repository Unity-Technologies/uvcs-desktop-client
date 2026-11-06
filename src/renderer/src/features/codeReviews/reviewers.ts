import type { CodeReviewer, CodeReviewStatus, CodeReviewSummary } from '@shared/domain/codeReview';
import type { LucideIcon } from 'lucide-react';
import { displayName } from '../../lib/userName';
import { isGroup, reviewerLabel, type ReviewerGroups } from './reviewerGroups';
import { REVIEW_STATUS_COLORS, REVIEW_STATUS_ICONS } from './reviewStatusIcons';
import type { StackedAvatar } from '../../ui/AvatarStack';

/** How many reviewers a row shows before "+N". */
export const SHOWN_REVIEWERS = 3;

/** What a review's row shows of nobody asked to review it. */
export const NO_REVIEWERS = 'Nobody';

/**
 * The reviewers a row shows, the rest it counts in "+N", and the name of a sole reviewer, which fits beside their
 * avatar (several show only avatars, each named in its own tooltip).
 */
export function shownReviewers(reviewers: readonly CodeReviewer[], groups: ReviewerGroups, max = SHOWN_REVIEWERS): { shown: CodeReviewer[]; rest: CodeReviewer[]; soleName?: string } {
  return {
    shown: reviewers.slice(0, max),
    rest: reviewers.slice(max),
    ...(reviewers.length === 1 && { soleName: reviewerLabel(reviewers[0]!, groups) }),
  };
}

/** How big a reviewer's avatar is, in the list, the details and the review's page alike. */
export const REVIEWER_AVATAR_SIZE = 18;

/**
 * The Reviewers column's width: the stack of `SHOWN_REVIEWERS` avatars and "+N" spread, with its last badge, inside the
 * cell's padding (`reviewersColumn.test.ts` holds it to that), or a sole reviewer's avatar and name.
 */
export const REVIEWERS_COLUMN_WIDTH = 130;

/**
 * The reviewers' stack: each shown reviewer's avatar (a group's icon for a group), named with their status and badged
 * with its icon, then a "+N" disc naming the rest; a sole reviewer's name goes beside it.
 */
export function stackedReviewers(reviewers: readonly CodeReviewer[], groups: ReviewerGroups): { avatars: StackedAvatar[]; more?: { count: number; tip: string }; soleName?: string } {
  const { shown, rest, soleName } = shownReviewers(reviewers, groups);
  return {
    avatars: shown.map((reviewer) => ({
      user: reviewer.name,
      tip: reviewerText(reviewer, groups),
      badge: reviewerBadge(reviewer.status),
      ...(isGroup(reviewer, groups) && { group: true }),
    })),
    ...(rest.length > 0 && { more: { count: rest.length, tip: reviewersText(rest, groups) } }),
    ...(soleName && { soleName }),
  };
}

/** A reviewer with the status they gave, a group said to be one: what their avatar's own tooltip says. */
export function reviewerText(reviewer: CodeReviewer, groups: ReviewerGroups): string {
  const name = reviewerLabel(reviewer, groups);
  return `${isGroup(reviewer, groups) ? `${name} (group)` : name}: ${reviewer.status}`;
}

/** Each reviewer with the status they gave: what the row's tooltip, the "+N" one and a screen reader say. */
export function reviewersText(reviewers: readonly CodeReviewer[], groups: ReviewerGroups): string {
  return reviewers.length === 0 ? NO_REVIEWERS : reviewers.map((reviewer) => reviewerText(reviewer, groups)).join(', ');
}

/** A reviewer's badge in the stack: the icon of the status they gave, in its color; every status has one. */
export function reviewerBadge(status: CodeReviewStatus): { icon: LucideIcon; color: string } {
  return { icon: REVIEW_STATUS_ICONS[status], color: REVIEW_STATUS_COLORS[status] };
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

/** Who the server lists to pick from (`cm listusers --onlyusers` and `--onlygroups`). */
export interface ServerMembers {
  users: readonly string[];
  groups: readonly string[];
}

/**
 * Who the reviewer picker offers: the review's reviewers first, as they were when it opened (rows don't jump while
 * picking), then the server's other groups by name, then its other users by the name shown, as the official client
 * lists them. A reviewer the server doesn't list still shows; a name is offered once, as a group when it is one.
 */
export function offeredReviewers({ users, groups }: ServerMembers, reviewers: readonly string[]): string[] {
  const offered = [...reviewers];
  const named = new Set(offered.map((name) => name.toLowerCase()));
  const others = (names: readonly string[], label: (name: string) => string): string[] => {
    const unnamed = names.filter((name) => !named.has(name.toLowerCase())).sort((a, b) => label(a).localeCompare(label(b)));
    for (const name of unnamed) named.add(name.toLowerCase());
    return unnamed;
  };
  return [...offered, ...others(groups, (name) => name), ...others(users, displayName)];
}

/**
 * Whether a reviewer can be asked to review again: once they gave a status, which asking puts back to "Under review".
 * Not the user themselves: they set their own status with Your review.
 */
export function canReRequest(reviewer: CodeReviewer, user: string | undefined): boolean {
  return reviewer.status !== 'Under review' && reviewer.name.toLowerCase() !== user?.toLowerCase();
}

/** Whether `user` is the review's author: as a reviewer (they may review their own changes too), or a comment's. */
export function isAuthor(review: Pick<CodeReviewSummary, 'owner'>, user: string): boolean {
  return user.toLowerCase() === review.owner.toLowerCase();
}
