import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { EVERYONE, MINE, type PeoplePick } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { createViewFilters, type FilterUpgrade, type ViewFilters } from '../../lib/viewFilters';

export type StatusFilter = CodeReviewStatus | 'any';

/**
 * The State chip: `active`, the code reviews and the merge requests still to merge (Open, Draft); one state of a merge
 * request; or `all` (`matchesState`).
 */
export type MergeRequestStateFilter = 'active' | 'merged' | 'closed' | 'all';

/** The Kind chip: merge requests and code reviews together (`any`), or one kind alone (`matchesKind`). */
export type ReviewKindFilter = 'any' | 'mergeRequests' | 'codeReviews';

interface CodeReviewsFilters extends ViewFilters {
  since: SincePreset;
  status: StatusFilter;
  /** Which merge requests, by state; an older version's remembered filters have none and read as `active`. */
  mergeRequestState: MergeRequestStateFilter;
  /** Which kind of review; an older version's remembered filters have none and read as `any`. */
  kind: ReviewKindFilter;
  /** Who is asked to review them, picked as the people filter picks who created them. */
  reviewers: PeoplePick;
  /** Only the reviews waiting for the user (`waitingForMe`): their review, or their own review's rework. */
  waitingForMe: boolean;
  /** Only the user's reviews not reviewed yet (`matchesOpenedByMe`). */
  openedByMe: boolean;
}

export const CLEARED_CODE_REVIEW_FILTERS: Partial<CodeReviewsFilters> = { status: 'any', mergeRequestState: 'active', kind: 'any', reviewers: EVERYONE, waitingForMe: false, openedByMe: false };

/** "I'm a reviewer" was a chip of its own, remembered as `reviewerIsMe`, before the reviewers were picked as people. */
export const restoredReviewersFilter: FilterUpgrade<CodeReviewsFilters> = (remembered) => (remembered.reviewerIsMe === true ? { reviewers: MINE } : {});

export const useCodeReviewsViewStore = createViewFilters<CodeReviewsFilters>(
  'code-reviews-view',
  { text: '', people: EVERYONE, since: 'last3Months', status: 'any', mergeRequestState: 'active', kind: 'any', reviewers: EVERYONE, waitingForMe: false, openedByMe: false },
  CLEARED_CODE_REVIEW_FILTERS,
  [],
  restoredReviewersFilter,
);
