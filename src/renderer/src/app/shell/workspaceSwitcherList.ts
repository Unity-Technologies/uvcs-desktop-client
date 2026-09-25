import type { WorkspaceSummary } from '@shared/domain/workspace';
import { lastSegment } from '../../lib/paths';
import { matchesAllWords } from '../../lib/matchesAllWords';

export interface SwitcherWorkspace extends WorkspaceSummary {
  /** A recent workspace `cm` no longer knows: its folder was moved or deleted (or it was removed elsewhere). */
  missing: boolean;
}

export interface WorkspaceSwitcherList {
  recent: SwitcherWorkspace[];
  others: SwitcherWorkspace[];
}

/**
 * The workspaces to switch to, without the open one: the recent ones in the order they were used (flagging those
 * that are gone), then the rest by name. The filter matches the name, the folder and the repository (when known).
 * Empty until the workspace list has loaded, so nothing is flagged as missing in the meantime.
 */
export function workspaceSwitcherList(
  workspaces: WorkspaceSummary[] | undefined,
  recentPaths: string[],
  currentPath: string,
  repositories: Record<string, string | null> | undefined,
  filter: string,
): WorkspaceSwitcherList {
  if (!workspaces) return { recent: [], others: [] };

  const byPath = new Map(workspaces.map((workspace) => [workspace.path, workspace]));
  const matches = (workspace: WorkspaceSummary): boolean =>
    workspace.path !== currentPath &&
    (!filter.trim() || matchesAllWords(`${workspace.name} ${workspace.path} ${repositories?.[workspace.path] ?? ''}`, filter));

  const recent = recentPaths
    .map((path): SwitcherWorkspace => {
      const workspace = byPath.get(path);
      return workspace ? { ...workspace, missing: false } : { name: lastSegment(path), path, guid: path, missing: true };
    })
    .filter(matches);
  const others = workspaces
    .filter((workspace) => !recentPaths.includes(workspace.path) && matches(workspace))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((workspace) => ({ ...workspace, missing: false }));
  return { recent, others };
}
