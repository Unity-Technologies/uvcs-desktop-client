import type { QueryClient } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { queryKeys } from '../../api/queryKeys';

/**
 * The key of a merge request's conflicts check (`useMergeRequestConflicts`): its source, then what the check is keyed
 * by (the source's head, the destination and its head). The source alone names every check of that branch.
 */
export function mergeConflictsKey(place: Place, source: string | undefined, ...keyedBy: unknown[]): readonly unknown[] {
  return queryKeys.inPlace(place, 'mergeConflicts', source, ...keyedBy);
}

/** Whether the conflicts of a request from `source` were checked in this window: an answer or a failure is kept. */
export function conflictsCheckedIn(client: QueryClient, place: Place): (source: string) => boolean {
  return (source) => client.getQueryCache().findAll({ queryKey: mergeConflictsKey(place, source) }).length > 0;
}
