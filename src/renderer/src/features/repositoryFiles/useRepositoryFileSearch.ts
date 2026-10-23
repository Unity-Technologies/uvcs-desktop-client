import { useEffect, useReducer } from 'react';
import type { RepositoryPlace } from '@shared/domain/place';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { nextRepositoryFileSearch, searchesFor, type RepositoryFileSearch } from './repositoryFileSearch';

/** How long typing pauses before a search runs: each keystroke would scan the tree again. */
const SEARCH_DELAY_MS = 150;

/**
 * Searches a repository's files at a changeset by name as the query settles (`explorer.findRepositoryPaths`): the best
 * found so far as they come (`repositoryPathsFound`), then all of them (`nextRepositoryFileSearch`). A newer query stops
 * the search before it (`stopFindingRepositoryPaths`).
 */
export function useRepositoryFileSearch(place: RepositoryPlace, changesetId: number, query: string): RepositoryFileSearch {
  const settled = useDebouncedValue(query, SEARCH_DELAY_MS);
  const [search, dispatch] = useReducer(nextRepositoryFileSearch, { kind: 'empty' });

  useUvcsEvent('repositoryPathsFound', ({ searchId, paths, source }) => dispatch({ kind: 'progress', searchId, paths, source }));

  useEffect(() => {
    if (!searchesFor(settled)) {
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
