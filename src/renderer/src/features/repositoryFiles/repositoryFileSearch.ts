import type { FoundPath, FoundPathsSource } from '@shared/domain/explorer';
import { goToFileKey } from '../../components/goToFileKeys';
import { fuzzyMatchPositions } from '../../lib/fuzzyIndex';

/** Results on screen and the query they answer: a new search keeps the ones before it until its own come. */
export interface FoundFor {
  query: string;
  paths: FoundPath[];
}

/** Where a search of a repository's files stands (`useRepositoryFileSearch`). */
export type RepositoryFileSearch =
  | { kind: 'empty' }
  | { kind: 'searching'; searchId: string; query: string; results: FoundFor | null; source: FoundPathsSource | null }
  | { kind: 'found'; results: FoundFor }
  | { kind: 'failed'; message: string };

/** What happens to a search: the query emptied, a search of `query` started, its best results so far, its end. */
export type RepositoryFileSearchEvent =
  | { kind: 'empty' }
  | { kind: 'started'; searchId: string; query: string }
  | { kind: 'progress'; searchId: string; paths: FoundPath[]; source: FoundPathsSource }
  | { kind: 'found'; searchId: string; paths: FoundPath[] }
  | { kind: 'failed'; searchId: string; message: string };

/** One result as it's drawn: its path, its icon and the characters the query matched. */
export interface RepositoryFileSearchRow {
  path: string;
  itemType: 'file' | 'directory';
  matches: number[];
}

/** What a search shows: its rows, whether it waits for the first, what it says (`repositoryFileSearchView`). */
export interface RepositoryFileSearchView {
  rows: RepositoryFileSearchRow[];
  loading: boolean;
  note: string | null;
  /** Whether the rows answer the query typed, not one it replaced while it settles: only then can Enter pick one. */
  current: boolean;
}

/** What a key in the search's field does: move the highlight, or pick a result's path. */
export type RepositoryFileSearchKey = { kind: 'highlight'; index: number } | { kind: 'pick'; path: string };

/**
 * Whether a query searches: from its first character, spaces aside. Any query costs one read of the tree's file, its
 * best results alone kept (`BestPaths`), so a short one costs no more than a long one.
 */
export function searchesFor(query: string): boolean {
  return query.trim() !== '';
}

/**
 * Whether the changeset's whole tree is listed now (`prepareRepositoryPaths`): only once something is typed. The search
 * sits beside a tree most users browse by opening folders, and the listing is the server's heaviest read.
 */
export function listsTreeNow(changesetId: number | null, query: string): boolean {
  return changesetId !== null && searchesFor(query);
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
      return { kind: 'searching', searchId: event.searchId, query: event.query, results: resultsOf(search), source: null };
    default:
      if (search.kind !== 'searching' || search.searchId !== event.searchId) return search;
      if (event.kind === 'progress') return { ...search, results: { query: search.query, paths: event.paths }, source: event.source };
      if (event.kind === 'found') return { kind: 'found', results: { query: search.query, paths: event.paths } };
      return { kind: 'failed', message: event.message };
  }
}

/** What the search shows while `query` is typed, of the tree called `branch`. */
export function repositoryFileSearchView(search: RepositoryFileSearch, query: string, branch: string): RepositoryFileSearchView {
  const results = resultsOf(search);
  const paths = results?.paths ?? [];
  return {
    rows: paths.map((found) => ({ path: found.path, itemType: found.isDirectory ? 'directory' : 'file', matches: fuzzyMatchPositions(found.path, query) })),
    loading: search.kind === 'searching' && paths.length === 0,
    note: repositoryFileSearchNote(search, query, branch),
    current: results?.query === query,
  };
}

/**
 * What `key` does in the search's field with the `highlighted` row: arrows move the highlight, Enter picks it. Enter
 * picks nothing while the rows answer an older query (`current`), so it never opens what the user typed past.
 */
export function repositoryFileSearchKey(key: string, highlighted: number, view: RepositoryFileSearchView): RepositoryFileSearchKey | null {
  const count = view.rows.length;
  if (key === 'Enter' && !view.current) return null;
  const effect = goToFileKey(key, Math.min(highlighted, Math.max(0, count - 1)), count);
  if (effect?.kind === 'pick') return { kind: 'pick', path: view.rows[effect.index]!.path };
  return effect;
}

function resultsOf(search: RepositoryFileSearch): FoundFor | null {
  if (search.kind === 'found') return search.results;
  return search.kind === 'searching' ? search.results : null;
}

/** What the search says under its field, beside the results (none when there are results to show). */
function repositoryFileSearchNote(search: RepositoryFileSearch, query: string, branch: string): string | null {
  switch (search.kind) {
    case 'empty':
      return `Type a name to find a file in ${branch}.`;
    case 'searching':
      if (search.results && search.results.paths.length > 0) return null;
      // The first search of a changeset lists its whole tree from the server: say so, it takes seconds.
      return search.source === 'disk' ? 'Searching…' : `Reading the files of ${branch} from the server…`;
    case 'found':
      return search.results.paths.length === 0 ? `No files match “${query.trim()}”.` : null;
    case 'failed':
      return `Couldn't search the files: ${search.message}`;
  }
}
