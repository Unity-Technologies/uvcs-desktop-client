import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { shelvesListFilter, shelvesSearchFilter, type ShelvesScope } from './shelvesScope';

const SEARCH_DELAY_MS = 300;

/**
 * The user's shelves of the last three months, newest first: one `cm find` filtered on the server by owner and date,
 * read when Changes shows. Never polled: shelving, applying and deleting refresh it (`isAffectedByShelving`), and
 * other clients' shelves show within five minutes.
 */
export function useMyShelves() {
  return useShelvesList('mine');
}

/**
 * Everyone's shelves of the last three months, newest first, read the same way as the user's, only once the user asks
 * to see them (`enabled`).
 */
export function useEveryonesShelves(enabled: boolean) {
  return useShelvesList('everyone', enabled);
}

function useShelvesList(scope: ShelvesScope, enabled = true) {
  const workspacePath = useWorkspacePath();
  const filter = shelvesListFilter(scope);
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'shelves', filter),
    queryFn: () => api.shelves.list(workspacePath, filter),
    enabled,
    ...SLOW_CHANGING_QUERY,
  });
}

/** The shelves of `scope` whose comment matches `text`, once typing pauses: older ones than the list has. */
export function useShelvesSearch(scope: ShelvesScope, text: string) {
  const workspacePath = useWorkspacePath();
  const filter = shelvesSearchFilter(scope, useDebouncedValue(text, SEARCH_DELAY_MS));
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'shelves', filter),
    queryFn: () => api.shelves.list(workspacePath, filter!),
    enabled: filter !== null,
  });
}
