import { useQuery } from '@tanstack/react-query';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { sinceDateFor } from '../../lib/sincePresets';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

/** How far back Changes lists the user's shelves; searching finds older ones. */
export const MY_SHELVES_SINCE = 'last3Months';

/** Room for the loose matches of a case-tolerant server search (`caseTolerantPattern`), filtered precisely after. */
const SEARCH_LIMIT = 50;
const SEARCH_DELAY_MS = 300;
/** `like` patterns drop each word's first letter: two letters would match nearly everything. */
const MIN_SEARCH_LENGTH = 3;
const SHELVE_NUMBER = /^(?:sh:)?\d+$/i;

/**
 * The user's shelves of the last three months, newest first: one `cm find` filtered on the server by owner and date,
 * read when Changes shows. Never polled: shelving, applying and deleting refresh it (`isAffectedByShelving`), and
 * other clients' shelves show within five minutes.
 */
export function useMyShelves() {
  const workspacePath = useWorkspacePath();
  const filter: QueryFilter = { owner: 'me', sinceDate: sinceDateFor(MY_SHELVES_SINCE) };
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'shelves', filter),
    queryFn: () => api.shelves.list(workspacePath, filter),
    ...SLOW_CHANGING_QUERY,
  });
}

/**
 * The user's shelves of any age whose comment matches `text`, once typing pauses: older ones than `useMyShelves`
 * lists. Numbers match only what is listed (the server searches comments).
 */
export function useMyShelvesSearch(text: string) {
  const workspacePath = useWorkspacePath();
  const term = useDebouncedValue(text.trim(), SEARCH_DELAY_MS);
  const filter: QueryFilter = { owner: 'me', text: term, limit: SEARCH_LIMIT };
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'shelves', filter),
    queryFn: () => api.shelves.list(workspacePath, filter),
    enabled: term.length >= MIN_SEARCH_LENGTH && !SHELVE_NUMBER.test(term),
  });
}
