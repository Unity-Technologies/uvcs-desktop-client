import { partialMatchKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { queryKeys } from '../../api/queryKeys';
import { usePlace } from '../../app/workspace/useWorkspace';
import { changesetKey } from '../../features/changesets/useChangeset';
import { cachedAreaOf, summaryIn } from './cachedSummary';

/**
 * A reference's summary from what the window already read (`summaryIn`), kept up to date as its area's lists are
 * read again: it never asks the server for anything, and wakes only for its own area's data.
 */
export function useCachedSummary(reference: CommentReference | undefined): string | undefined {
  const place = usePlace();
  const queryClient = useQueryClient();
  const area = reference ? cachedAreaOf(reference) : null;
  const areaKey = useMemo(() => (area ? queryKeys.inPlace(place, area) : null), [area, place]);
  const read = useCallback(() => {
    if (!areaKey || !reference) return undefined;
    return summaryIn(
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
