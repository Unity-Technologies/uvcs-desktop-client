import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Branch } from '@shared/domain/branch';
import { queryKeys } from '../../../api/queryKeys';
import { useSession } from '../../workspace/sessionStore';
import { suggestedTrackerLink } from './connectFlow';

/** A tracker the branch comments the window already read link to (`suggestedTrackerLink`): offered, never filled in. Reads nothing. */
export function useSuggestedLink() {
  const queryClient = useQueryClient();
  const place = useSession((state) => state.place);
  return useMemo(() => {
    if (!place) return null;
    const lists = queryClient.getQueriesData<Branch[]>({ queryKey: queryKeys.inPlace(place, 'branches') });
    const comments = lists.flatMap(([, branches]) => (Array.isArray(branches) ? branches.map((branch) => branch.comment ?? '') : []));
    return suggestedTrackerLink(comments);
  }, [queryClient, place]);
}
