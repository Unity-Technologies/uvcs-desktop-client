import type { WorkspaceSummary } from '@shared/domain/workspace';
import { useSettings } from '../settings/useSettings';
import { useMissingWorkspacePaths, useRecentWorkspaceRepositories, useWorkspaceHeads, useWorkspaceList } from '../workspace/workspaceQueries';
import { recentWorkspaceEntries, unlistedRecentPaths, type WorkspaceEntry } from './recentWorkspaces';

/**
 * The home screen's workspaces, recent ones first, each with its repository and branch where cheaply known: the
 * `.plastic` folder says, and `cm` is asked only about recent workspaces whose folder couldn't tell.
 */
export function useWorkspaceEntries(filter: string) {
  const { recentWorkspacePaths } = useSettings();
  const { data: workspaces, isLoading, error } = useWorkspaceList();
  const { data: heads, isFetched: headsRead } = useWorkspaceHeads(workspaces);
  const { data: repositories } = useRecentWorkspaceRepositories(headsRead ? workspaces : undefined, heads);
  const { data: missingPaths = [] } = useMissingWorkspacePaths(workspaces ? unlistedRecentPaths(workspaces, recentWorkspacePaths) : []);

  const described = ({ workspace, missing }: Pick<WorkspaceEntry, 'workspace' | 'missing'>): WorkspaceEntry => {
    const head = heads?.[workspace.path];
    return { workspace, missing, repository: head?.repository ?? repositories?.[workspace.path], selector: head?.selector ?? null };
  };
  const matching = (entry: WorkspaceEntry): boolean => matches(entry, filter);

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

function matches({ workspace, repository, selector }: WorkspaceEntry, filter: string): boolean {
  return `${workspace.name} ${workspace.path} ${repository ?? ''} ${selector?.name ?? ''}`.toLowerCase().includes(filter.toLowerCase());
}
