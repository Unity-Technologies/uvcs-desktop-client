import { useEffect, useRef, useState } from 'react';
import type { RepositoryPlace } from '@shared/domain/place';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { searchesFor, type RepositoryFileSearch } from './repositoryFileSearch';

/** How long typing pauses before a search runs: each keystroke would scan the tree again. */
const SEARCH_DELAY_MS = 150;

let searches = 0;

/**
 * Searches a repository's files at a changeset by name as the query settles (`explorer.findRepositoryPaths`): the best
 * found so far as they come (`repositoryPathsFound`), then all of them. A newer query stops the search before it
 * (`stopFindingRepositoryPaths`), whose results are kept on screen until the new ones come.
 */
export function useRepositoryFileSearch(place: RepositoryPlace, changesetId: number, query: string): RepositoryFileSearch {
  const settled = useDebouncedValue(query, SEARCH_DELAY_MS);
  const [search, setSearch] = useState<RepositoryFileSearch>({ kind: 'tooShort' });
  const current = useRef<string | null>(null);

  useUvcsEvent('repositoryPathsFound', ({ searchId, paths, source }) => {
    if (searchId === current.current) setSearch({ kind: 'searching', paths, source });
  });

  useEffect(() => {
    if (!searchesFor(settled)) {
      setSearch({ kind: 'tooShort' });
      return;
    }
    const searchId = `files-${++searches}`;
    current.current = searchId;
    setSearch((before) => ({ kind: 'searching', paths: before.kind === 'found' || before.kind === 'searching' ? before.paths : [], source: null }));
    api.explorer.findRepositoryPaths(place, changesetId, settled, searchId).then(
      (paths) => {
        if (current.current === searchId) setSearch({ kind: 'found', paths });
      },
      (error: unknown) => {
        if (current.current === searchId) setSearch({ kind: 'failed', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      current.current = null;
      void api.explorer.stopFindingRepositoryPaths(searchId);
    };
  }, [place, changesetId, settled]);

  return search;
}
