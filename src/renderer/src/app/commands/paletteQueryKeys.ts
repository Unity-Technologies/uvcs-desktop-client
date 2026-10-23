import type { QueryFilter } from '@shared/domain/query';
import type { Place } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';

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
