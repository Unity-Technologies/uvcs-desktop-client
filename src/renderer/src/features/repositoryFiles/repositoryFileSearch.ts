import type { FoundPath, FoundPathsSource } from '@shared/domain/explorer';

/** Where a search of a repository's files stands (`useRepositoryFileSearch`). */
export type RepositoryFileSearch =
  | { kind: 'empty' }
  | { kind: 'searching'; searchId: string; paths: FoundPath[]; source: FoundPathsSource | null }
  | { kind: 'found'; paths: FoundPath[] }
  | { kind: 'failed'; message: string };

/** What happens to a search: the query emptied, a search started, its best results so far, its end. */
export type RepositoryFileSearchEvent =
  | { kind: 'empty' }
  | { kind: 'started'; searchId: string }
  | { kind: 'progress'; searchId: string; paths: FoundPath[]; source: FoundPathsSource }
  | { kind: 'found'; searchId: string; paths: FoundPath[] }
  | { kind: 'failed'; searchId: string; message: string };

/** What the dialog shows of a search: its results, whether it waits for the first, and what it says (`repositoryFileSearchView`). */
export interface RepositoryFileSearchView {
  paths: FoundPath[];
  loading: boolean;
  note: string | null;
}

/**
 * Whether a query searches: from its first character, spaces aside. Any query costs one read of the tree's file, its
 * best results alone kept (`BestPaths`), so a short one costs no more than a long one.
 */
export function searchesFor(query: string): boolean {
  return query.trim() !== '';
}

/**
 * The search after `event`. A new search keeps the results before it on screen until its own come; what an older search
 * tells, one a newer query replaced, is ignored.
 */
export function nextRepositoryFileSearch(search: RepositoryFileSearch, event: RepositoryFileSearchEvent): RepositoryFileSearch {
  switch (event.kind) {
    case 'empty':
      return { kind: 'empty' };
    case 'started':
      return { kind: 'searching', searchId: event.searchId, paths: resultsOf(search), source: null };
    default:
      if (search.kind !== 'searching' || search.searchId !== event.searchId) return search;
      if (event.kind === 'progress') return { ...search, paths: event.paths, source: event.source };
      if (event.kind === 'found') return { kind: 'found', paths: event.paths };
      return { kind: 'failed', message: event.message };
  }
}

/** What the dialog shows of the search of `query` in `branch`. */
export function repositoryFileSearchView(search: RepositoryFileSearch, query: string, branch: string): RepositoryFileSearchView {
  const paths = resultsOf(search);
  return { paths, loading: search.kind === 'searching' && paths.length === 0, note: repositoryFileSearchNote(search, query, branch) };
}

function resultsOf(search: RepositoryFileSearch): FoundPath[] {
  return search.kind === 'searching' || search.kind === 'found' ? search.paths : [];
}

/** What the dialog says under its field, beside the results (none when there are results to show). */
function repositoryFileSearchNote(search: RepositoryFileSearch, query: string, branch: string): string | null {
  switch (search.kind) {
    case 'empty':
      return `Type a name to find a file in ${branch}.`;
    case 'searching':
      if (search.paths.length > 0) return null;
      // The first search of a changeset lists its whole tree from the server: say so, it takes seconds.
      return search.source === 'disk' ? 'Searching…' : `Reading the files of ${branch} from the server…`;
    case 'found':
      return search.paths.length === 0 ? `No files match “${query.trim()}”.` : null;
    case 'failed':
      return `Couldn't search the files: ${search.message}`;
  }
}
