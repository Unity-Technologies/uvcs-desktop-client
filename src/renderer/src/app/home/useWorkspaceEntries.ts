import type { WorkspaceSummary } from '@shared/domain/workspace';
import { useSettings } from '../settings/useSettings';
import { useMissingWorkspacePaths, useWorkspaceList } from '../workspace/workspaceQueries';
import { entryMatches, recentWorkspaceEntries, unlistedRecentPaths, type WorkspaceEntry } from './recentWorkspaces';
import { useDescribeWorkspace } from './useDescribeWorkspace';

/** The home screen's workspaces, recent ones first, each with its repository and branch where cheaply known. */
export function useWorkspaceEntries(filter: string) {
  const { recentWorkspacePaths } = useSettings();
  const { data: workspaces, isLoading, error } = useWorkspaceList();
  const described = useDescribeWorkspace(workspaces);
  const { data: missingPaths = [] } = useMissingWorkspacePaths(workspaces ? unlistedRecentPaths(workspaces, recentWorkspacePaths) : []);
  const matching = (entry: WorkspaceEntry): boolean => entryMatches(entry, filter);

  return {
    workspaces,
    isLoading,
    error,
    recent: recentWorkspaceEntries(workspaces ?? [], recentWorkspacePaths, missingPaths).map(described).filter(matching),
    all: sortedByName(workspaces ?? [])
      .map((workspace) => described({ workspace, missing: false }))
      .filter(matching),
  };
}

function sortedByName(workspaces: WorkspaceSummary[]): WorkspaceSummary[] {
  return [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
}
