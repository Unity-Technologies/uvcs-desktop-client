import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { reviewSummariesKey } from '../../features/codeReviews/useCodeReviews';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { queryClient } from '../queryClient';
import { lacksServerMatch, searchesServerFor } from './paletteGroups';
import { branchesKey, changesetsKey, labelsKey, shelvesKey } from './paletteQueryKeys';
import { isInScope, type PaletteScope, type SectionId } from './paletteScope';

/** Room for the loose matches of a case-tolerant server search, which are filtered precisely here. */
const SERVER_SEARCH_LIMIT = 50;
const SERVER_SEARCH_DELAY_MS = 300;
const SERVER_SEARCH_STALE_TIME = 60_000;

/**
 * Once typing pauses, `cm find ... like` asks the server for what the cached lists may miss (objects created since,
 * or beyond the cached limits), only for the sections in scope. `term` is the settled term the answers are for.
 */
export function usePaletteServerSearch(workspacePath: string | null, typed: string, scope: PaletteScope) {
  const path = workspacePath ?? '';
  const term = useDebouncedValue(typed, SERVER_SEARCH_DELAY_MS);
  const searches = Boolean(workspacePath) && searchesServerFor(term);
  const server = (section: SectionId) => ({ enabled: searches && isInScope(section, scope), staleTime: SERVER_SEARCH_STALE_TIME });
  const textFilter: QueryFilter = { text: term, limit: SERVER_SEARCH_LIMIT };

  return {
    term,
    searches,
    branches: useQuery({ queryKey: branchesKey(path, textFilter), queryFn: () => api.branches.list(path, textFilter), ...server('branches') }),
    labels: useQuery({ queryKey: labelsKey(path, textFilter), queryFn: () => api.labels.list(path, textFilter), ...server('labels') }),
    shelves: useQuery({ queryKey: shelvesKey(path, textFilter), queryFn: () => api.shelves.list(path, textFilter), ...server('shelves') }),
    codeReviews: useQuery({
      queryKey: reviewSummariesKey(path, term),
      queryFn: () => api.codeReviews.listSummaries(path, { text: term }),
      ...server('codeReviews'),
    }),
  };
}

/**
 * The search of every changeset's comment, which takes seconds on big repositories: only on demand (`start`), for
 * the term typed then.
 */
export function useChangesetSearch(workspacePath: string | null) {
  const path = workspacePath ?? '';
  const [term, start] = useState<string>();
  const filter: QueryFilter = { text: term, limit: SERVER_SEARCH_LIMIT };
  const found = useQuery({
    queryKey: changesetsKey(path, filter),
    queryFn: () => api.changesets.list(path, filter),
    enabled: Boolean(workspacePath) && term !== undefined,
    staleTime: SERVER_SEARCH_STALE_TIME,
  });
  return { term, found, start };
}

/** Re-reads a fully cached list (`{}` filter) when the server found something it lacks: it is out of date. */
export function useRefreshWhenMissing(
  found: { id: number }[] | undefined,
  cached: { id: number }[] | undefined,
  workspacePath: string,
  area: 'branches' | 'labels',
): void {
  useEffect(() => {
    if (!lacksServerMatch(found, cached)) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.inWorkspace(workspacePath, area, {}), exact: true });
  }, [found, cached, workspacePath, area]);
}
