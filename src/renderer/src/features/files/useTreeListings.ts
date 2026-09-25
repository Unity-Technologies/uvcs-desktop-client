import { useQueries } from '@tanstack/react-query';
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
  const directories = ['', ...expanded];

  return useQueries({
    queries: directories.map((directory) => ({
      queryKey: queryKeyFor(directory),
      queryFn: () => listDirectory(directory),
      placeholderData: (previous: TreeItem[] | undefined) => previous,
    })),
    combine: (results) => {
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
  });
}
