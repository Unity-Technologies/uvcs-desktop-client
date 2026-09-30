import { useQueries, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import type { TreeItem } from '@shared/domain/explorer';

interface TreeListings {
  childrenByDirectory: ReadonlyMap<string, TreeItem[]>;
  isLoadingRoot: boolean;
  error: Error | null;
}

/** How one folder of a tree is read (`''` is the root): its query key and how to list it. */
export type ListingQuery = (directory: string) => { queryKey: readonly unknown[]; queryFn: () => Promise<TreeItem[]> };

/**
 * Lists the root and every expanded directory, each one as its own cached query,
 * so expanding a folder only fetches that folder.
 */
export function useTreeListings(listingQuery: ListingQuery, expanded: ReadonlySet<string>): TreeListings {
  const directories = useMemo(() => ['', ...expanded], [expanded]);
  const listed = useRef<ReadonlyMap<string, TreeItem[]>>(new Map());
  // A stable `combine` runs only when a query's state changes, and gives back the same listings while none of them
  // changed: the tree isn't rebuilt on every render (a selection change), nor re-rendered as each folder is re-read.
  const combine = useCallback(
    (results: UseQueryResult<TreeItem[]>[]): TreeListings => {
      const childrenByDirectory = new Map<string, TreeItem[]>();
      results.forEach((result, index) => {
        if (result.data) childrenByDirectory.set(directories[index]!, result.data);
      });
      if (!haveSameListings(childrenByDirectory, listed.current)) listed.current = childrenByDirectory;
      return {
        childrenByDirectory: listed.current,
        isLoadingRoot: results[0]?.isLoading ?? false,
        error: results[0]?.error ?? null,
      };
    },
    [directories],
  );

  return useQueries({
    queries: directories.map((directory) => ({
      ...listingQuery(directory),
      placeholderData: (previous: TreeItem[] | undefined) => previous,
    })),
    combine,
  });
}

/** Whether both hold the same listings (by reference: a re-read that found no change keeps its data). */
export function haveSameListings(a: ReadonlyMap<string, TreeItem[]>, b: ReadonlyMap<string, TreeItem[]>): boolean {
  if (a.size !== b.size) return false;
  for (const [directory, items] of a) if (b.get(directory) !== items) return false;
  return true;
}
