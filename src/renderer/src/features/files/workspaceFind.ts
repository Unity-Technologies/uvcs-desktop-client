import type { FuzzyIndex } from '../../lib/fuzzyIndex';

export interface FoundItem {
  path: string;
  isDirectory: boolean;
}

/** As many as a look down the list takes in: a query that finds more is typed on, as in Go to file. */
export const FIND_LIMIT = 200;

/**
 * The workspace's items best matching `query`, best first: the fuzzy "go to file" ranking over every path on disk,
 * read once (`useWorkspacePaths`); none for an empty query.
 */
export function findItems(index: FuzzyIndex, items: readonly FoundItem[], query: string, limit = FIND_LIMIT): FoundItem[] {
  if (!query.trim()) return [];
  return index.rank(query, limit).map((position) => items[position]!);
}
