import type { WorkspaceSummary } from '@shared/domain/workspace';
import { matchesAllWords } from '../../lib/matchesAllWords';
import { recentWorkspaceEntries, type WorkspaceEntry } from '../home/recentWorkspaces';

export interface WorkspaceSwitcherList {
  recent: WorkspaceEntry[];
  others: WorkspaceEntry[];
}

/**
 * The workspaces to switch to, without the open one: the recent ones in the order they were used (with the ones
 * whose folder is missing), then the rest by name. The filter matches the name, the folder and the repository.
 */
export function workspaceSwitcherList(
  workspaces: WorkspaceSummary[],
  recentPaths: string[],
  missingPaths: string[],
  currentPath: string,
  repositories: Record<string, string | null> | undefined,
  filter: string,
): WorkspaceSwitcherList {
  const matches = ({ workspace }: WorkspaceEntry): boolean =>
    workspace.path !== currentPath &&
    (!filter.trim() || matchesAllWords(`${workspace.name} ${workspace.path} ${repositories?.[workspace.path] ?? ''}`, filter));

  const recent = recentWorkspaceEntries(workspaces, recentPaths, missingPaths).filter(matches);
  const others = workspaces
    .filter((workspace) => !recentPaths.includes(workspace.path))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((workspace) => ({ workspace, missing: false }))
    .filter(matches);
  return { recent, others };
}
