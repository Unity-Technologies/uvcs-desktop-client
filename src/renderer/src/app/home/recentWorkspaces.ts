import type { WorkspaceSummary } from '@shared/domain/workspace';
import { lastSegment } from '../../lib/paths';

export interface WorkspaceEntry {
  workspace: WorkspaceSummary;
  /** Its folder is gone; `cm` no longer lists it, only the recent list remembers it. */
  missing: boolean;
}

/** Recent paths `cm` doesn't list: candidates for a missing folder. */
export function unlistedRecentPaths(workspaces: WorkspaceSummary[], recentPaths: string[]): string[] {
  const listed = new Set(workspaces.map((workspace) => workspace.path));
  return recentPaths.filter((path) => !listed.has(path));
}

/** The recent workspaces in recent order, including the ones whose folder is missing. */
export function recentWorkspaceEntries(workspaces: WorkspaceSummary[], recentPaths: string[], missingPaths: string[]): WorkspaceEntry[] {
  return recentPaths.flatMap((path): WorkspaceEntry[] => {
    const workspace = workspaces.find((candidate) => candidate.path === path);
    if (workspace) return [{ workspace, missing: false }];
    // Its name went with the folder; the folder name usually matches it.
    return missingPaths.includes(path) ? [{ workspace: { name: lastSegment(path), path, guid: path }, missing: true }] : [];
  });
}
