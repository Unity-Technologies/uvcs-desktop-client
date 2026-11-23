import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { EVERYONE, MINE, type PeoplePick } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { createViewFilters, type FilterUpgrade, type ViewFilters } from '../../lib/viewFilters';
import { restoredStates, STILL_TO_MERGE, type MergeRequestStates } from './mergeRequestStatesFilter';

export type StatusFilter = CodeReviewStatus | 'any';

/** The Kind chip: merge requests and code reviews together (`any`), or one kind alone (`matchesKind`). */
export type ReviewKindFilter = 'any' | 'mergeRequests' | 'codeReviews';

interface CodeReviewsFilters extends ViewFilters {
  since: SincePreset;
  status: StatusFilter;
  /** The merge request states ticked (`matchesStates`); an older version's one choice reads as its states (`restoredStates`). */
  mergeRequestStates: MergeRequestStates;
  /** Which kind of review; an older version's remembered filters have none and read as `any`. */
  kind: ReviewKindFilter;
  /** Who is asked to review them, picked as the people filter picks who created them. */
  reviewers: PeoplePick;
  /** Only the reviews waiting for the user (`waitingForMe`): their review, or their own review's rework. */
  waitingForMe: boolean;
  /** Only the user's reviews not reviewed yet (`matchesOpenedByMe`). */
  openedByMe: boolean;
}

export const CLEARED_CODE_REVIEW_FILTERS: Partial<CodeReviewsFilters> = { status: 'any', mergeRequestStates: STILL_TO_MERGE, kind: 'any', reviewers: EVERYONE, waitingForMe: false, openedByMe: false };

/** "I'm a reviewer" was a chip of its own, remembered as `reviewerIsMe`, before the reviewers were picked as people. */
export const restoredReviewersFilter: FilterUpgrade<CodeReviewsFilters> = (remembered) => (remembered.reviewerIsMe === true ? { reviewers: MINE } : {});

/**
 * The State chip picked one choice, remembered as `mergeRequestState`, before it ticked states; a list remembered is
 * checked too, as any remembered value is (`restoredStates`).
 */
export const restoredStatesFilter: FilterUpgrade<CodeReviewsFilters> = (remembered) => ({ mergeRequestStates: restoredStates(remembered.mergeRequestStates ?? remembered.mergeRequestState) });

export const useCodeReviewsViewStore = createViewFilters<CodeReviewsFilters>(
  'code-reviews-view',
  { text: '', people: EVERYONE, since: 'last3Months', status: 'any', mergeRequestStates: STILL_TO_MERGE, kind: 'any', reviewers: EVERYONE, waitingForMe: false, openedByMe: false },
  CLEARED_CODE_REVIEW_FILTERS,
  [],
  (remembered) => ({ ...restoredReviewersFilter(remembered), ...restoredStatesFilter(remembered) }),
);
