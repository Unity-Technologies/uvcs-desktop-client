import type { CodeReview, CodeReviewFilter, CodeReviewSummary } from '@shared/domain/codeReview';
import { isEveryone, isOnlyMine, pickedOwners, type PeoplePick } from '../../lib/peopleFilter';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { sameUser, userFilterTexts } from '../../lib/userName';
import type { ReviewKindFilter, StatusFilter } from './codeReviewsViewStore';
import { isActiveMergeRequest } from './mergeRequestState';
import { EVERY_STATE, serverStateOf, type MergeRequestStates } from './mergeRequestStatesFilter';
import { describeTarget } from './reviewTarget';
import { waitingForMe } from './waitingForMe';

interface CodeReviewsQueryFilters {
  since: SincePreset;
  /** Who created them, once picking paused (`PICKING_PAUSE_MS`). */
  people: PeoplePick;
  status: StatusFilter;
  /** The merge request states ticked: Merged or Closed alone is the server's; any other pick reads with no state (`serverStateOf`). */
  mergeRequestStates: MergeRequestStates;
  /** Who is asked to review them: I'm a reviewer, people picked, both. */
  reviewers: PeoplePick;
}

/**
 * What Merge requests asks `cm find review` for: who created them, whether the user is asked to review them, the status
 * and the time range; the text is matched locally. I'm a reviewer alone is the server's (`where reviewer = 'me'`);
 * with other reviewers picked, the query asks for every review, as no reviewer filter does (one query key and one `cm
 * find`), and keeps the rows locally (`matchesReviewers`): `cm find review` takes no reviewer but the user. Waiting for
 * me and Opened by me ask nothing of their own: they keep the reviews read, in the time range (`matchesWaiting`,
 * `matchesOpenedByMe`), so their counts are what pressing them shows, and pressing them runs no command. Merged alone
 * or Closed alone asks the server for that state; any other pick of states asks for none and narrows locally
 * (`matchesStates`), as `cm find` takes one state, so they all share one query key.
 */
export function codeReviewsQuery({ since, people, status, mergeRequestStates, reviewers }: CodeReviewsQueryFilters, today = new Date()): CodeReviewFilter {
  return { owners: pickedOwners(people), reviewerIsMe: isOnlyMine(reviewers), status: status === 'any' ? undefined : status, mergeRequestState: serverStateOf(mergeRequestStates), sinceDate: sinceDateFor(since, today) };
}

/**
 * What Merge requests' list is read with, from the view's chips: `codeReviewsQuery` under the state the Kind chip leaves
 * (`stateUnderKind`). The view and the sidebar's count (`useCodeReviewsListFilter`) both read with it, so they share one
 * query key and one `cm find review`.
 */
export function codeReviewsListQuery({ kind, mergeRequestStates, ...filters }: CodeReviewsQueryFilters & { kind: ReviewKindFilter }, today = new Date()): CodeReviewFilter {
  return codeReviewsQuery({ ...filters, mergeRequestStates: statesUnderKind(kind, mergeRequestStates) }, today);
}

/**
 * The states the list goes by under the Kind chip: the State chip's, except with Code reviews alone, which have no
 * state: then every review is asked for and kept (every state), and the State chip hides (`showsStateChip`).
 */
export function statesUnderKind(kind: ReviewKindFilter, states: MergeRequestStates): MergeRequestStates {
  return kind === 'codeReviews' ? EVERY_STATE : states;
}

/** Whether the State chip shows: a merge request's state means nothing to code reviews alone. */
export function showsStateChip(kind: ReviewKindFilter): boolean {
  return kind !== 'codeReviews';
}

/**
 * Whether a review read shows under the Kind chip: both kinds, merge requests alone, or code reviews alone. Local:
 * the reviews are read together whatever the kind (one query key), so switching it runs no command.
 */
export function matchesKind(review: Pick<CodeReviewSummary, 'mergeRequest'>, kind: ReviewKindFilter): boolean {
  if (kind === 'any') return true;
  return (review.mergeRequest !== undefined) === (kind === 'mergeRequests');
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

/**
 * Whether a review read shows under Opened by me: all while it's off; while on, the user's code reviews not reviewed
 * yet, and their merge requests still to merge whatever the review says (one reviewed is still theirs to merge).
 */
export function matchesOpenedByMe(review: Pick<CodeReviewSummary, 'owner' | 'status' | 'mergeRequest'>, on: boolean, user: string | undefined): boolean {
  if (!on) return true;
  if (user === undefined || !sameUser(review.owner, user)) return false;
  return review.mergeRequest ? isActiveMergeRequest(review) : review.status !== 'Reviewed';
}

/**
 * Whether the list shows fewer reviews than it read, so an empty one says none match (with Clear filters) rather than
 * none yet: a filter is on, or the State chip at rest (Draft or open) hides what was read, every review merged or closed.
 */
export function isNarrowed(filtering: boolean, read: number, shown: number): boolean {
  return filtering || shown < read;
}

/** How many of the reviews read Opened by me keeps. */
export function openedByMeCount(reviews: readonly Pick<CodeReviewSummary, 'owner' | 'status' | 'mergeRequest'>[], user: string | undefined): number {
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

/**
 * What the row shows, which its filter looks through: its number, title, what it reviews, where a merge request merges
 * and its state, its author and its reviewers.
 */
export function reviewFilterTexts(review: Pick<CodeReview, 'id' | 'title' | 'owner' | 'reviewers' | 'mergeRequest'> & { target?: CodeReview['target'] }): string[] {
  const target = review.target ? [describeTarget(review.target)] : [];
  const merge = review.mergeRequest ? [review.mergeRequest.destination, review.mergeRequest.state] : [];
  const reviewers = review.reviewers.flatMap((reviewer) => userFilterTexts(reviewer.name));
  return [String(review.id), review.title, ...target, ...merge, ...userFilterTexts(review.owner), ...reviewers];
}
