import { partialMatchKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { queryKeys } from '../../api/queryKeys';
import { usePlace } from '../../app/workspace/useWorkspace';
import { changesetKey } from '../../features/changesets/changesetKey';
import { cachedAreaOf, cachedObjectIn, type CachedObject } from './cachedSummary';

/**
 * The object a reference names in what the window already read (`cachedObjectIn`): its summary (`summaryOf`)
 * and its hover card's fields (`cachedRecordOf`), kept up to date as its area's lists are read again. It never asks
 * the server for anything, and wakes only for its own area's data.
 */
export function useCachedObject(reference: CommentReference | undefined): CachedObject | undefined {
  const place = usePlace();
  const queryClient = useQueryClient();
  const area = reference ? cachedAreaOf(reference) : null;
  const areaKey = useMemo(() => (area ? queryKeys.inPlace(place, area) : null), [area, place]);
  const read = useCallback(() => {
    if (!areaKey || !reference) return undefined;
    return cachedObjectIn(
      queryClient.getQueryCache().findAll({ queryKey: areaKey }).map((query) => query.state.data),
      reference,
      reference.kind === 'changeset' ? queryClient.getQueryData(changesetKey(place, reference.id)) : undefined,
    );
  }, [areaKey, queryClient, reference, place]);
  const subscribe = useCallback(
    (changed: () => void) => {
      if (!areaKey) return () => {};
      return queryClient.getQueryCache().subscribe((event) => {
        if ((event.type === 'updated' || event.type === 'removed') && partialMatchKey(event.query.queryKey, areaKey)) changed();
      });
    },
    [areaKey, queryClient],
  );
  return useSyncExternalStore(subscribe, read);
}
