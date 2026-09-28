import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { EVERYONE } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { createViewFilters, type ViewFilters } from '../../lib/viewFilters';

export type StatusFilter = CodeReviewStatus | 'any';

interface CodeReviewsFilters extends ViewFilters {
  since: SincePreset;
  status: StatusFilter;
  /** Only the reviews the user is asked to review; the people filter goes by who created them. */
  assignedToMe: boolean;
}

export const CLEARED_CODE_REVIEW_FILTERS: Partial<CodeReviewsFilters> = { status: 'any', assignedToMe: false };

export const useCodeReviewsViewStore = createViewFilters<CodeReviewsFilters>(
  'code-reviews-view',
  { text: '', people: EVERYONE, since: 'last3Months', status: 'any', assignedToMe: false },
  CLEARED_CODE_REVIEW_FILTERS,
);
