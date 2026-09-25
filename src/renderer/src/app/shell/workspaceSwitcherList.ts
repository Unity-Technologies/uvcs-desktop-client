import type { WorkspaceSummary } from '@shared/domain/workspace';
import { matchesAllWords } from '../../lib/matchesAllWords';

export interface WorkspaceSwitcherList {
  recent: WorkspaceSummary[];
  others: WorkspaceSummary[];
}

/**
 * The workspaces to switch to, without the open one: the recent ones in the order they were used,
 * then the rest by name. The filter matches the name, the folder and the repository (when known).
 */
export function workspaceSwitcherList(
  workspaces: WorkspaceSummary[],
  recentPaths: string[],
  currentPath: string,
  repositories: Record<string, string | null> | undefined,
  filter: string,
): WorkspaceSwitcherList {
  const matches = (workspace: WorkspaceSummary): boolean =>
    !filter.trim() || matchesAllWords(`${workspace.name} ${workspace.path} ${repositories?.[workspace.path] ?? ''}`, filter);
  const candidates = workspaces.filter((workspace) => workspace.path !== currentPath && matches(workspace));
  const recent = recentPaths.flatMap((path) => candidates.find((workspace) => workspace.path === path) ?? []);
  const others = candidates.filter((workspace) => !recentPaths.includes(workspace.path)).sort((a, b) => a.name.localeCompare(b.name));
  return { recent, others };
}
