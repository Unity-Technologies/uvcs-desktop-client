import type { FoundPath, FoundPathsSource } from '@shared/domain/explorer';

/** Characters a query needs before a repository's files are searched: fewer would match nearly every path. */
export const MIN_QUERY_LENGTH = 2;

/** Where a search of a repository's files stands (`useRepositoryFileSearch`). */
export type RepositoryFileSearch =
  | { kind: 'tooShort' }
  | { kind: 'searching'; paths: FoundPath[]; source: FoundPathsSource | null }
  | { kind: 'found'; paths: FoundPath[] }
  | { kind: 'failed'; message: string };

/** Whether a query is long enough to search (`MIN_QUERY_LENGTH`), its spaces aside. */
export function searchesFor(query: string): boolean {
  return query.replace(/\s+/g, '').length >= MIN_QUERY_LENGTH;
}

/** What the dialog says under its field, beside the results (none when there are results to show). */
export function repositoryFileSearchNote(search: RepositoryFileSearch, query: string, branch: string): string | null {
  switch (search.kind) {
    case 'tooShort':
      return `Type ${MIN_QUERY_LENGTH} or more characters to find a file in ${branch}.`;
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
