import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { EVERYONE } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { createViewFilters, type FilterUpgrade, type ViewFilters } from '../../lib/viewFilters';

export type StatusFilter = CodeReviewStatus | 'any';

/**
 * Which reviews show by the user's part in them: any, those the user is asked to review (`me`), or those waiting for
 * the user (`waitingForMe`).
 */
export type ReviewerFilter = 'anyone' | 'me' | 'waitingForMe';

interface CodeReviewsFilters extends ViewFilters {
  since: SincePreset;
  status: StatusFilter;
  /** The people filter goes by who created them. */
  reviewer: ReviewerFilter;
}

export const CLEARED_CODE_REVIEW_FILTERS: Partial<CodeReviewsFilters> = { status: 'any', reviewer: 'anyone' };

/** "I'm a reviewer" was a chip, remembered as `reviewerIsMe`, before it became the reviewer menu. */
export const restoredReviewerFilter: FilterUpgrade<CodeReviewsFilters> = (remembered) => (remembered.reviewerIsMe === true ? { reviewer: 'me' } : {});

export const useCodeReviewsViewStore = createViewFilters<CodeReviewsFilters>(
  'code-reviews-view',
  { text: '', people: EVERYONE, since: 'last3Months', status: 'any', reviewer: 'anyone' },
  CLEARED_CODE_REVIEW_FILTERS,
  [],
  restoredReviewerFilter,
);
