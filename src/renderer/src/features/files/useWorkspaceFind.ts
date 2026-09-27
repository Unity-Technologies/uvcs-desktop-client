import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { TreeItem } from '@shared/domain/explorer';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { createFuzzyIndex } from '../../lib/fuzzyIndex';
import { useSettledValue } from '../../lib/useSettled';
import { useWorkspacePaths } from './useWorkspacePaths';
import { findItems, type FoundItem } from './workspaceFind';

/**
 * The Files find over the whole workspace: every path read once from disk (Go to file's list, no `cm`), ranked as the
 * query is typed. Nothing is read until something is looked for.
 */
export function useWorkspaceFind(workspacePath: string, query: string): { items: FoundItem[]; isLoading: boolean } {
  const finding = query.trim() !== '';
  const { data: entries, isLoading } = useWorkspacePaths(workspacePath, finding);
  const index = useMemo(() => entries && createFuzzyIndex(entries.map((entry) => entry.path)), [entries]);
  const items = useMemo(() => (index && entries ? findItems(index, entries, query) : []), [index, entries, query]);
  return { items, isLoading: finding && isLoading };
}

/**
 * The found item the selection settled on, as its folder's listing has it (the tree's own query, often read already):
 * its details need its revision, which a path alone doesn't tell. One listing per folder stopped on, never per row.
 */
export function useFoundItem(workspacePath: string, path: string | null): TreeItem | undefined {
  const settledPath = useSettledValue(path, path ?? '');
  // Tree paths use forward slashes; an item at the root is listed with the root's ('').
  const directory = settledPath?.slice(0, Math.max(settledPath.lastIndexOf('/'), 0)) ?? '';
  const { data: listing } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'explorer', 'directory', directory),
    queryFn: () => api.explorer.listDirectory(workspacePath, directory),
    enabled: settledPath !== null,
  });
  return settledPath === null ? undefined : listing?.find((item) => item.path === settledPath);
}
