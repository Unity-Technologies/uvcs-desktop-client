import type { CodeReviewFilter } from '@shared/domain/codeReview';
import { PICKING_PAUSE_MS } from '../../lib/peopleFilter';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { codeReviewsListQuery } from './codeReviewFilters';
import { useCodeReviewsViewStore } from './codeReviewsViewStore';

/**
 * What Merge requests' list is read with (`codeReviewsListQuery`), from the view's chips, with the people picked once
 * picking paused (`PICKING_PAUSE_MS`). The view and the sidebar's count (`useWaitingForMeBadge`) both read with it, so
 * they share one query key and one `cm find review`.
 */
export function useCodeReviewsListFilter(): CodeReviewFilter {
  const since = useCodeReviewsViewStore((state) => state.since);
  const people = useDebouncedValue(useCodeReviewsViewStore((state) => state.people), PICKING_PAUSE_MS);
  const status = useCodeReviewsViewStore((state) => state.status);
  const kind = useCodeReviewsViewStore((state) => state.kind);
  const mergeRequestState = useCodeReviewsViewStore((state) => state.mergeRequestState);
  const reviewers = useDebouncedValue(useCodeReviewsViewStore((state) => state.reviewers), PICKING_PAUSE_MS);
  return codeReviewsListQuery({ since, people, status, kind, mergeRequestState, reviewers });
}
