import type { WorkspaceHead, WorkspaceSelector, WorkspaceSummary } from '@shared/domain/workspace';
import { matchesAllWords } from '../../lib/matchesAllWords';
import { lastSegment } from '../../lib/paths';
import { splitRepositorySpec } from '../../lib/servers';

export interface WorkspaceEntry {
  workspace: WorkspaceSummary;
  /** Its folder is gone; `cm` no longer lists it, only the recent list remembers it. */
  missing: boolean;
  /** `name@server`; undefined while still resolving, null when unknown. */
  repository?: string | null;
  /** The repository's own name, known even while its server isn't (a Unity organization's, `WorkspaceHead`). */
  repositoryName?: string;
  /** What it's loaded from, when its folder tells without asking `cm`. */
  selector?: WorkspaceSelector | null;
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

/**
 * The workspaces whose selector file names their repository; `cm` is asked about the recent ones among the rest
 * (`useRecentWorkspaceRepositories`): a Unity organization's, whose file keeps its server by an id people never see.
 */
export function headsNamingRepository(heads: Record<string, WorkspaceHead> = {}): Record<string, WorkspaceHead> {
  return Object.fromEntries(Object.entries(heads).filter(([, head]) => head.repository !== null));
}

/**
 * A listed workspace with what is cheaply known of it: its selector file's repository and branch, else the repository
 * `cm` named in the recent workspaces' lookup (`lookedUp`), keeping the file's repository name meanwhile.
 */
export function describedEntry(entry: Pick<WorkspaceEntry, 'workspace' | 'missing'>, head: WorkspaceHead | undefined, lookedUp: Record<string, string | null>): WorkspaceEntry {
  const repository = head?.repository ?? lookedUp[entry.workspace.path];
  const repositoryName = head?.repositoryName ?? (repository ? splitRepositorySpec(repository).name : undefined);
  return { ...entry, repository, repositoryName, selector: head?.selector ?? null };
}

/** Whether a workspace is found by the home screen's search: every word of it in its name, path, repository or branch. */
export function entryMatches({ workspace, repository, repositoryName, selector }: WorkspaceEntry, filter: string): boolean {
  return !filter.trim() || matchesAllWords(`${workspace.name} ${workspace.path} ${repository ?? repositoryName ?? ''} ${selector?.name ?? ''}`, filter);
}
