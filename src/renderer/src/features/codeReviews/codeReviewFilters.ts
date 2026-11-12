import type { CodeReview, CodeReviewFilter, CodeReviewSummary } from '@shared/domain/codeReview';
import { isEveryone, isOnlyMine, pickedOwners, type PeoplePick } from '../../lib/peopleFilter';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { sameUser, userFilterTexts } from '../../lib/userName';
import type { StatusFilter } from './codeReviewsViewStore';
import { describeTarget } from './reviewTarget';
import { waitingForMe } from './waitingForMe';

interface CodeReviewsQueryFilters {
  since: SincePreset;
  /** Who created them, once picking paused (`PICKING_PAUSE_MS`). */
  people: PeoplePick;
  status: StatusFilter;
  /** Who is asked to review them: I'm a reviewer, people picked, both. */
  reviewers: PeoplePick;
}

/**
 * What Code reviews asks `cm find review` for: who created them, whether the user is asked to review them, the status
 * and the time range; the text is matched locally. I'm a reviewer alone is the server's (`where reviewer = 'me'`);
 * with other reviewers picked, the query asks for every review, as no reviewer filter does (one query key and one `cm
 * find`), and keeps the rows locally (`matchesReviewers`): `cm find review` takes no reviewer but the user. Waiting for
 * me is local too (`matchesWaiting`).
 */
export function codeReviewsQuery({ since, people, status, reviewers }: CodeReviewsQueryFilters, today = new Date()): CodeReviewFilter {
  return { owners: pickedOwners(people), reviewerIsMe: isOnlyMine(reviewers), status: status === 'any' ? undefined : status, sinceDate: sinceDateFor(since, today) };
}

/** Whether any reviewer picked is asked on the review (the user under I'm a reviewer, `me`); every review with none picked. */
export function matchesReviewers(review: Pick<CodeReviewSummary, 'reviewers'>, pick: PeoplePick, me: string | undefined): boolean {
  if (isEveryone(pick)) return true;
  return review.reviewers.some(({ name }) => pick.others.includes(name) || (pick.mine && (me === undefined || sameUser(name, me))));
}

/** Whether a review read shows under Waiting for me: all of them while it's off; those waiting for the user (`waitingForMe`) while on. */
export function matchesWaiting(review: Pick<CodeReviewSummary, 'owner' | 'status' | 'reviewers' | 'openIssueCount'>, on: boolean, user: string | undefined): boolean {
  return !on || waitingForMe(review, user) !== undefined;
}

/** Waiting for me's chip, with how many reviews read wait for the user: "Waiting for me · 2". */
export function waitingChipLabel(waiting: number): string {
  return waiting > 0 ? `Waiting for me · ${waiting}` : 'Waiting for me';
}

/** What the row shows, which its filter looks through: its number, title, what it reviews, its author and its reviewers. */
export function reviewFilterTexts(review: Pick<CodeReview, 'id' | 'title' | 'owner' | 'reviewers'> & { target?: CodeReview['target'] }): string[] {
  const target = review.target ? [describeTarget(review.target)] : [];
  const reviewers = review.reviewers.flatMap((reviewer) => userFilterTexts(reviewer.name));
  return [String(review.id), review.title, ...target, ...userFilterTexts(review.owner), ...reviewers];
}
