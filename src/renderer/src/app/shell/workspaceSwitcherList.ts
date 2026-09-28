import type { WorkspaceSummary } from '@shared/domain/workspace';
import { entryMatches, recentWorkspaceEntries, type WorkspaceEntry } from '../home/recentWorkspaces';

export interface WorkspaceSwitcherList {
  recent: WorkspaceEntry[];
  others: WorkspaceEntry[];
}

/**
 * The workspaces to switch to, without the open one: the recent ones in the order they were used (with the ones
 * whose folder is missing), then the rest by name, each told as `describe` knows it. The filter matches as the home
 * screen's search does: the name, the folder, the repository and the branch.
 */
export function workspaceSwitcherList(
  workspaces: WorkspaceSummary[],
  recentPaths: string[],
  missingPaths: string[],
  currentPath: string,
  describe: (entry: Pick<WorkspaceEntry, 'workspace' | 'missing'>) => WorkspaceEntry,
  filter: string,
): WorkspaceSwitcherList {
  const matches = (entry: WorkspaceEntry): boolean => entry.workspace.path !== currentPath && entryMatches(entry, filter);

  const recent = recentWorkspaceEntries(workspaces, recentPaths, missingPaths).map(describe).filter(matches);
  const others = workspaces
    .filter((workspace) => !recentPaths.includes(workspace.path))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((workspace) => describe({ workspace, missing: false }))
    .filter(matches);
  return { recent, others };
}

/**
 * The row the keyboard is on: the workspace it was put on, wherever the list moved it while loading (recent
 * workspaces whose folder turned out missing come in above it), else the first.
 */
export function highlightedRow(entries: WorkspaceEntry[], path: string | null): number {
  return Math.max(0, entries.findIndex((entry) => entry.workspace.path === path));
}
