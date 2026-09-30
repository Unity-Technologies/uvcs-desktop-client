import type { CodeReview, CodeReviewFilter } from '@shared/domain/codeReview';
import { pickedOwners, type PeoplePick } from '../../lib/peopleFilter';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { userFilterTexts } from '../../lib/userName';
import type { StatusFilter } from './codeReviewsViewStore';
import { describeTarget } from './reviewTarget';

interface CodeReviewsQueryFilters {
  since: SincePreset;
  /** Who created them, once picking paused (`PICKING_PAUSE_MS`). */
  people: PeoplePick;
  status: StatusFilter;
  assignedToMe: boolean;
}

/**
 * What Code reviews asks `cm find review` for: who created them, whether the user is asked to review them, the status
 * and the time range; the text is matched locally.
 */
export function codeReviewsQuery({ since, people, status, assignedToMe }: CodeReviewsQueryFilters, today = new Date()): CodeReviewFilter {
  return { owners: pickedOwners(people), assignedToMe, status: status === 'any' ? undefined : status, sinceDate: sinceDateFor(since, today) };
}

/** What the row shows, which its filter looks through: its number, title, what it reviews, its author and its reviewer. */
export function reviewFilterTexts(review: CodeReview): string[] {
  return [String(review.id), review.title, describeTarget(review.target), ...userFilterTexts(review.owner), ...(review.assignee ? userFilterTexts(review.assignee) : [])];
}
