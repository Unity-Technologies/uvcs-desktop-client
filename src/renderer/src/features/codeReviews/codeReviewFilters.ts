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
  /** Only those waiting for the user: of any date, as the official client's "Needs my review" reads them. */
  waitingForMe: boolean;
  /** Only the user's not reviewed yet: of any date, as the official client's "Opened by me" reads them. */
  openedByMe: boolean;
}

/**
 * What Code reviews asks `cm find review` for: who created them, whether the user is asked to review them, the status
 * and the time range; the text is matched locally. I'm a reviewer alone is the server's (`where reviewer = 'me'`);
 * with other reviewers picked, the query asks for every review, as no reviewer filter does (one query key and one `cm
 * find`), and keeps the rows locally (`matchesReviewers`): `cm find review` takes no reviewer but the user. Waiting for
 * me is local too (`matchesWaiting`), over reviews of any date: one left waiting for months is still the user's to do.
 * Opened by me reads the user's reviews of any date (`owners: me`, unless people are picked, kept as picked) and keeps
 * those not reviewed yet locally (`matchesOpenedByMe`): the query takes one status, not two.
 */
export function codeReviewsQuery({ since, people, status, reviewers, waitingForMe, openedByMe }: CodeReviewsQueryFilters, today = new Date()): CodeReviewFilter {
  const sinceDate = waitingForMe || openedByMe ? undefined : sinceDateFor(since, today);
  const owners = openedByMe && isEveryone(people) ? ['me'] : pickedOwners(people);
  return { owners, reviewerIsMe: isOnlyMine(reviewers), status: status === 'any' ? undefined : status, sinceDate };
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

/** Whether a review read shows under Opened by me: all while it's off; the user's, not reviewed yet, while on. */
export function matchesOpenedByMe(review: Pick<CodeReviewSummary, 'owner' | 'status'>, on: boolean, user: string | undefined): boolean {
  return !on || (user !== undefined && sameUser(review.owner, user) && review.status !== 'Reviewed');
}

/** How many of the reviews read Opened by me keeps. */
export function openedByMeCount(reviews: readonly Pick<CodeReviewSummary, 'owner' | 'status'>[], user: string | undefined): number {
  return reviews.filter((review) => matchesOpenedByMe(review, true, user)).length;
}

/** Opened by me's chip, with how many it keeps: "Opened by me · 2". */
export function openedChipLabel(opened: number): string {
  return opened > 0 ? `Opened by me · ${opened}` : 'Opened by me';
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
