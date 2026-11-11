import { useEffect, useReducer } from 'react';
import type { RepositoryPlace } from '@shared/domain/place';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { nextRepositoryFileSearch, searchesFor, type RepositoryFileSearch } from './repositoryFileSearch';

/** How long typing pauses before a search runs: each keystroke would scan the tree again. */
const SEARCH_DELAY_MS = 150;

/** When the repository's whole tree is listed: as the search shows, or only once something is typed in it. */
export type TreeListing = 'onOpen' | 'onSearch';

/**
 * Searches a repository's files at a changeset by name as the query settles (`explorer.findRepositoryPaths`): the best
 * found so far as they come (`repositoryPathsFound`), then all of them (`nextRepositoryFileSearch`). A newer query stops
 * the search before it (`stopFindingRepositoryPaths`). Waits while there's no changeset to search (`changesetId` null).
 *
 * The whole tree is listed once per changeset: Go to file lists it as it opens (`'onOpen'`), so its seconds pass while
 * the query is typed; a search beside a tree the user may never search (Choose what to download) lists it only on the
 * first keystroke (`'onSearch'`), sparing the server a listing nobody asked for.
 */
export function useRepositoryFileSearch(
  place: RepositoryPlace,
  changesetId: number | null,
  query: string,
  listing: TreeListing = 'onOpen',
): RepositoryFileSearch {
  const settled = useDebouncedValue(query, SEARCH_DELAY_MS);
  const [search, dispatch] = useReducer(nextRepositoryFileSearch, { kind: 'empty' });

  // `prepareRepositoryPaths` lists the tree unless it is listed or listing, so calling it again costs nothing.
  const wanted = listing === 'onOpen' || searchesFor(query);
  useEffect(() => {
    if (changesetId !== null && wanted) void api.explorer.prepareRepositoryPaths(place, changesetId);
  }, [place, changesetId, wanted]);

  useUvcsEvent('repositoryPathsFound', ({ searchId, paths, source }) => dispatch({ kind: 'progress', searchId, paths, source }));

  useEffect(() => {
    if (changesetId === null || !searchesFor(settled)) {
      dispatch({ kind: 'empty' });
      return;
    }
    // Unique across windows: the main process tells searches apart by it, whichever window asked.
    const searchId = crypto.randomUUID();
    dispatch({ kind: 'started', searchId });
    api.explorer.findRepositoryPaths(place, changesetId, settled, searchId).then(
      (paths) => dispatch({ kind: 'found', searchId, paths }),
      (error: unknown) => dispatch({ kind: 'failed', searchId, message: error instanceof Error ? error.message : String(error) }),
    );
    return () => void api.explorer.stopFindingRepositoryPaths(searchId);
  }, [place, changesetId, settled]);

  return search;
}
