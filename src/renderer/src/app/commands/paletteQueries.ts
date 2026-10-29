import type { QueryFilter } from '@shared/domain/query';
import type { Place } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { sinceDateFor } from '../../lib/sincePresets';
import { SLOW_CHANGING_QUERY } from '../queryClient';

/**
 * The palette reads the same lists as the views (`queryKeys.inPlace(place, area, filter)`), so a list either one
 * read answers the other, and an operation refreshing a view refreshes the palette's copy too.
 */
export function branchesKey(place: Place, filter: QueryFilter) {
  return queryKeys.inPlace(place, 'branches', filter);
}

export function labelsKey(place: Place, filter: QueryFilter) {
  return queryKeys.inPlace(place, 'labels', filter);
}

export function changesetsKey(place: Place, filter: QueryFilter) {
  return queryKeys.inPlace(place, 'changesets', filter);
}

export function shelvesKey(place: Place, filter: QueryFilter) {
  return queryKeys.inPlace(place, 'shelves', filter);
}

/**
 * The lists the palette answers from, which a comment's suggestions read too (`useSuggestionRows`): one query and one
 * cache entry for both. Heavy and slow to change (`SLOW_CHANGING_QUERY`).
 */
export function everyBranchQuery(place: Place) {
  return { queryKey: branchesKey(place, {}), queryFn: () => api.branches.list(place, {}), ...SLOW_CHANGING_QUERY };
}

/**
 * The hidden branches, apart from the visible ones `everyBranchQuery` reads (`cm find branch` leaves them out unless
 * asked): few, so one quick find, and the palette finds them too, the branch the workspace is on among them.
 */
export function hiddenBranchesQuery(place: Place) {
  const filter: QueryFilter = { onlyHidden: true };
  return { queryKey: branchesKey(place, filter), queryFn: () => api.branches.list(place, filter), ...SLOW_CHANGING_QUERY };
}

export function everyLabelQuery(place: Place) {
  return { queryKey: labelsKey(place, {}), queryFn: () => api.labels.list(place, {}), ...SLOW_CHANGING_QUERY };
}

/**
 * Shelves by everyone pile up by the thousand: the last three months', older ones found by the server search. The date
 * is worked out at each call, as the palette does, so both read the same key on any day.
 */
export function recentShelvesQuery(place: Place) {
  const filter: QueryFilter = { sinceDate: sinceDateFor('last3Months') };
  return { queryKey: shelvesKey(place, filter), queryFn: () => api.shelves.list(place, filter), ...SLOW_CHANGING_QUERY };
}
