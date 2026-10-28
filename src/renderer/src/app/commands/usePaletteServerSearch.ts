import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Place } from '@shared/domain/place';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { reviewSummariesKey } from '../../features/codeReviews/useCodeReviews';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { queryClient } from '../queryClient';
import { lacksServerMatch, searchesServerFor } from './paletteGroups';
import { branchesKey, changesetsKey, labelsKey, shelvesKey } from './paletteQueries';
import { isInScope, type PaletteScope, type SectionId } from './paletteScope';
import { NOWHERE } from './usePaletteLists';

/** Room for the loose matches of a case-tolerant server search, which are filtered precisely here. */
const SERVER_SEARCH_LIMIT = 50;
/** How long typing pauses before the server is asked: the palette's search, a comment's changeset lookup. */
export const SERVER_SEARCH_DELAY_MS = 300;
const SERVER_SEARCH_STALE_TIME = 60_000;

/**
 * Once typing pauses, `cm find ... like` asks the server for what the cached lists may miss (objects created since,
 * or beyond the cached limits), only for the sections in scope. `term` is the settled term the answers are for.
 */
export function usePaletteServerSearch(shown: Place | null, typed: string, scope: PaletteScope) {
  const place = shown ?? NOWHERE;
  const term = useDebouncedValue(typed, SERVER_SEARCH_DELAY_MS);
  const searches = shown !== null && searchesServerFor(term);
  const server = (section: SectionId) => ({ enabled: searches && isInScope(section, scope), staleTime: SERVER_SEARCH_STALE_TIME });
  const textFilter: QueryFilter = { text: term, limit: SERVER_SEARCH_LIMIT };

  return {
    term,
    searches,
    branches: useQuery({ queryKey: branchesKey(place, textFilter), queryFn: () => api.branches.list(place, textFilter), ...server('branches') }),
    labels: useQuery({ queryKey: labelsKey(place, textFilter), queryFn: () => api.labels.list(place, textFilter), ...server('labels') }),
    shelves: useQuery({ queryKey: shelvesKey(place, textFilter), queryFn: () => api.shelves.list(place, textFilter), ...server('shelves') }),
    codeReviews: useQuery({
      queryKey: reviewSummariesKey(place, term),
      queryFn: () => api.codeReviews.listSummaries(place, { text: term }),
      ...server('codeReviews'),
    }),
  };
}

/**
 * The search of every changeset's comment, which takes seconds on big repositories: only on demand (`start`), for
 * the term typed then.
 */
export function useChangesetSearch(shown: Place | null) {
  const place = shown ?? NOWHERE;
  const [term, start] = useState<string>();
  const filter: QueryFilter = { text: term, limit: SERVER_SEARCH_LIMIT };
  const found = useQuery({
    queryKey: changesetsKey(place, filter),
    queryFn: () => api.changesets.list(place, filter),
    enabled: shown !== null && term !== undefined,
    staleTime: SERVER_SEARCH_STALE_TIME,
  });
  return { term, found, start };
}

/** Re-reads a fully cached list (`{}` filter) when the server found something it lacks: it is out of date. */
export function useRefreshWhenMissing(
  found: { id: number }[] | undefined,
  cached: { id: number }[] | undefined,
  place: Place,
  area: 'branches' | 'labels',
): void {
  useEffect(() => {
    if (!lacksServerMatch(found, cached)) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.inPlace(place, area, {}), exact: true });
  }, [found, cached, place, area]);
}
