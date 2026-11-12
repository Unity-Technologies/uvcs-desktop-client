import { pluralize } from '../../lib/text';
import type { CodeReview, CodeReviewFilter, CodeReviewSummary } from '@shared/domain/codeReview';
import { pickedOwners, type PeoplePick } from '../../lib/peopleFilter';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { userFilterTexts } from '../../lib/userName';
import type { ReviewerFilter, StatusFilter } from './codeReviewsViewStore';
import { describeTarget } from './reviewTarget';
import { waitingForMe } from './waitingForMe';

interface CodeReviewsQueryFilters {
  since: SincePreset;
  /** Who created them, once picking paused (`PICKING_PAUSE_MS`). */
  people: PeoplePick;
  status: StatusFilter;
  reviewer: ReviewerFilter;
}

/**
 * What Code reviews asks `cm find review` for: who created them, whether the user is asked to review them, the status
 * and the time range; the text is matched locally. Waiting for me asks for every review, as no reviewer filter does
 * (one query key and one `cm find`), and keeps its rows locally (`matchesReviewer`): it takes the user's own reviews
 * too, which `reviewer = 'me'` leaves out, and it goes by each reviewer's own status, which the query can't ask for.
 */
export function codeReviewsQuery({ since, people, status, reviewer }: CodeReviewsQueryFilters, today = new Date()): CodeReviewFilter {
  return { owners: pickedOwners(people), reviewerIsMe: reviewer === 'me', status: status === 'any' ? undefined : status, sinceDate: sinceDateFor(since, today) };
}

/** The reviewer menu's choices, the first one not filtering. */
export const REVIEWER_CHOICES: { value: ReviewerFilter; label: string }[] = [
  { value: 'anyone', label: 'Any reviewer' },
  { value: 'me', label: "I'm a reviewer" },
  { value: 'waitingForMe', label: 'Waiting for me' },
];

/** The reviewer menu's choices, Waiting for me with how many reviews read wait for the user: "Waiting for me · 2". */
export function reviewerChoices(waiting: number): { value: ReviewerFilter; label: string }[] {
  return REVIEWER_CHOICES.map((choice) => (choice.value === 'waitingForMe' && waiting > 0 ? { ...choice, label: `${choice.label} · ${waiting}` } : choice));
}

/**
 * The reviewer chip's dot, and its words: while reviews wait for the user and the chip shows another choice, so Waiting
 * for me, inside its menu, is found; none otherwise.
 */
export function reviewerChipDot(reviewer: ReviewerFilter, waiting: number): string | undefined {
  return reviewer !== 'waitingForMe' && waiting > 0 ? `${pluralize(waiting, 'review')} waiting for you` : undefined;
}

/** Whether a review read shows under the reviewer filter: only Waiting for me narrows locally (`codeReviewsQuery`). */
export function matchesReviewer(review: Pick<CodeReviewSummary, 'owner' | 'status' | 'reviewers' | 'openIssueCount'>, reviewer: ReviewerFilter, user: string | undefined): boolean {
  return reviewer !== 'waitingForMe' || waitingForMe(review, user) !== undefined;
}

/** What the row shows, which its filter looks through: its number, title, what it reviews, its author and its reviewers. */
export function reviewFilterTexts(review: Pick<CodeReview, 'id' | 'title' | 'owner' | 'reviewers'> & { target?: CodeReview['target'] }): string[] {
  const target = review.target ? [describeTarget(review.target)] : [];
  const reviewers = review.reviewers.flatMap((reviewer) => userFilterTexts(reviewer.name));
  return [String(review.id), review.title, ...target, ...userFilterTexts(review.owner), ...reviewers];
}
