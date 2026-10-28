import { useCallback, useSyncExternalStore } from 'react';
import type { Place } from '@shared/domain/place';
import type { Shelve } from '@shared/domain/shelve';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';

/** The shelve from any list of shelves already read, so a page opened from one reads nothing more. */
export function cachedShelve(place: Place, shelveId: number): Shelve | undefined {
  return listedShelve(place, shelveId)?.shelve;
}

/**
 * `cachedShelve`, rendered again whenever a list of shelves changes in the cache: a shelve's diff shows its comment
 * from there, and an edit (`writeListedShelveComment`) or a list read again must show on it at once.
 */
export function useCachedShelve(place: Place, shelveId: number): Shelve | undefined {
  const read = useCallback(() => cachedShelve(place, shelveId), [place, shelveId]);
  return useSyncExternalStore(subscribeToQueryCache, read);
}

function subscribeToQueryCache(onChange: () => void): () => void {
  return queryClient.getQueryCache().subscribe(onChange);
}

/** The shelve from a list of shelves already read, and when that list was read. */
export function listedShelve(place: Place, shelveId: number): { shelve: Shelve; readAt: number } | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.inPlace(place, 'shelves') })) {
    const found = Array.isArray(query.state.data) ? (query.state.data as Shelve[]).find((shelve) => shelve.id === shelveId) : undefined;
    if (found) return { shelve: found, readAt: query.state.dataUpdatedAt };
  }
  return undefined;
}

/**
 * Writes a comment just saved into every list of shelves already read, so whatever shows the shelve from them (its
 * diff's header and menu, `cachedShelve`) shows it at once, before the lists are read again.
 */
export function writeListedShelveComment(place: Place, shelveId: number, comment: string): void {
  queryClient.setQueriesData<unknown>({ queryKey: queryKeys.inPlace(place, 'shelves') }, (data: unknown) =>
    Array.isArray(data) ? (data as Shelve[]).map((shelve) => (shelve.id === shelveId ? { ...shelve, comment } : shelve)) : data,
  );
}
