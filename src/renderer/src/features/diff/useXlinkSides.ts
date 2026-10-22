import { useQuery } from '@tanstack/react-query';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY, queryClient, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useSettledValue } from '../../lib/useSettled';
import { isImmutableDiff } from './immutableDiff';

/**
 * Where a changed xlink of the diff points on each side: two or three quick reads (`DiffApi.xlinkSides`), asked once
 * the selection settles on it, so arrowing past an xlink asks nothing. History doesn't change, so a changeset's or a
 * range's answer is kept; a branch's moves with its head, so it's re-read as the server lists are.
 */
export function useXlinkSides(workspacePath: string, target: DiffTarget, xlink: DiffEntry) {
  const queryKey = queryKeys.inWorkspace(workspacePath, 'xlinkSides', target, xlink.path, xlink.oldPath, xlink.status);
  const key = JSON.stringify(queryKey);
  const settled = useSettledValue(key, key) === key;
  const immutable = isImmutableDiff(target, undefined);
  return useQuery({
    queryKey,
    queryFn: () => api.diff.xlinkSides(workspacePath, target, { path: xlink.path, oldPath: xlink.oldPath, status: xlink.status }),
    enabled: settled || queryClient.getQueryData(queryKey) !== undefined,
    ...(immutable ? { staleTime: Infinity, meta: IMMUTABLE_QUERY } : SLOW_CHANGING_QUERY),
  });
}
