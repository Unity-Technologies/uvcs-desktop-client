import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { queryKeys } from '../../api/queryKeys';
import { usePlace } from '../../app/workspace/useWorkspace';
import { cachedAreaOf, summaryIn } from './cachedSummary';

/**
 * A reference's summary from what the window already read (`summaryIn`), kept up to date as more is read: it never
 * asks the server for anything.
 */
export function useCachedSummary(reference: CommentReference | undefined): string | undefined {
  const place = usePlace();
  const queryClient = useQueryClient();
  const area = reference ? cachedAreaOf(reference) : null;
  const read = useCallback(() => {
    if (!area || !reference) return undefined;
    const cached = queryClient.getQueryCache().findAll({ queryKey: queryKeys.inPlace(place, area) }).map((query) => query.state.data);
    return summaryIn(cached, reference);
  }, [area, place, queryClient, reference]);
  const subscribe = useCallback((changed: () => void) => (area ? queryClient.getQueryCache().subscribe(changed) : () => {}), [area, queryClient]);
  return useSyncExternalStore(subscribe, read);
}
