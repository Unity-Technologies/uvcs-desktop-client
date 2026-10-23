import type { Place } from '@shared/domain/place';
import type { Shelve } from '@shared/domain/shelve';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';

/** The shelve from any list of shelves already read, so a page opened from one reads nothing more. */
export function cachedShelve(place: Place, shelveId: number): Shelve | undefined {
  return listedShelve(place, shelveId)?.shelve;
}

/** The shelve from a list of shelves already read, and when that list was read. */
export function listedShelve(place: Place, shelveId: number): { shelve: Shelve; readAt: number } | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.inPlace(place, 'shelves') })) {
    const found = Array.isArray(query.state.data) ? (query.state.data as Shelve[]).find((shelve) => shelve.id === shelveId) : undefined;
    if (found) return { shelve: found, readAt: query.state.dataUpdatedAt };
  }
  return undefined;
}
