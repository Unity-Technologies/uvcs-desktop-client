import { useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { DiffTarget } from '@shared/domain/diff';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { isImmutableDiff } from './immutableDiff';

interface DiffEntriesOptions {
  /** False reads only what is already cached: `cm diff` is too heavy to run on every selection. */
  enabled?: boolean;
  /** The branch head the diff is read at, so a branch diff is reused until the branch moves. */
  branchHead?: number;
}

/** The query key of a diff's files: a branch's at the head it was read at. */
export function diffEntriesKey(place: Place, target: DiffTarget | null, branchHead?: number) {
  return branchHead === undefined ? queryKeys.inPlace(place, 'diff', target) : queryKeys.inPlace(place, 'diff', target, branchHead);
}

export function useDiffEntries(target: DiffTarget | null, { enabled = true, branchHead }: DiffEntriesOptions = {}) {
  const place = usePlace();
  const immutable = isImmutableDiff(target, branchHead);
  return useQuery({
    queryKey: diffEntriesKey(place, target, branchHead),
    queryFn: () => api.diff.entries(place, target!),
    enabled: enabled && target !== null,
    staleTime: immutable ? Infinity : 15_000,
    // Kept (the last objects opened, `MAX_UNUSED_IMMUTABLE`): coming back to one shows its files without asking the server again.
    gcTime: immutable ? Infinity : undefined,
    meta: immutable ? IMMUTABLE_QUERY : undefined,
  });
}
