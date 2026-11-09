import type { Place } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';

/**
 * Where a changeset read by its number is cached (`useChangeset`): `other` names the repository when it isn't the
 * place's. Apart from the hook, so a chip reads it without the API client (`useCachedObject`).
 */
export function changesetKey(place: Place, changesetId: number | null, other?: string) {
  return queryKeys.inPlace(place, 'changesets', 'byId', changesetId, other);
}
