import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { TreeItem } from '@shared/domain/explorer';

interface TreeListings {
  childrenByDirectory: ReadonlyMap<string, TreeItem[]>;
  isLoadingRoot: boolean;
  error: Error | null;
}

/**
 * Lists the root and every expanded directory, each one as its own cached query,
 * so expanding a folder only fetches that folder.
 */
export function useTreeListings(
  queryKeyFor: (directory: string) => readonly unknown[],
  listDirectory: (directory: string) => Promise<TreeItem[]>,
  expanded: ReadonlySet<string>,
): TreeListings {
  const directories = useMemo(() => ['', ...expanded], [expanded]);
  // A stable `combine` runs only when a listing changes, so the tree's rows aren't rebuilt on every render (a selection change).
  const combine = useCallback(
    (results: UseQueryResult<TreeItem[]>[]): TreeListings => {
      const childrenByDirectory = new Map<string, TreeItem[]>();
      results.forEach((result, index) => {
        if (result.data) childrenByDirectory.set(directories[index]!, result.data);
      });
      return {
        childrenByDirectory,
        isLoadingRoot: results[0]?.isLoading ?? false,
        error: results[0]?.error ?? null,
      };
    },
    [directories],
  );

  return useQueries({
    queries: directories.map((directory) => ({
      queryKey: queryKeyFor(directory),
      queryFn: () => listDirectory(directory),
      placeholderData: (previous: TreeItem[] | undefined) => previous,
    })),
    combine,
  });
}
