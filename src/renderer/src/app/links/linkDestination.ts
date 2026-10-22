import { sameServer } from '@shared/links/linkSegments';
import { splitRepositorySpec } from '../../lib/servers';

/** A workspace and the repository it works on (`name@server`), null when `cm` couldn't tell. */
export interface WorkspaceOnRepository {
  path: string;
  repository: string | null;
}

/**
 * Which workspace a repository link opens in (docs/features/deep-links.md, "Opening a link"):
 * - `here`: this window's workspace is on the repository;
 * - `workspace`: another window's, or the only one on it;
 * - `pick`: the user picks one of several, the most recently used first;
 * - `none`: no workspace is on the repository yet.
 */
export type LinkDestination = { kind: 'here' } | { kind: 'workspace'; path: string } | { kind: 'pick'; paths: string[] } | { kind: 'none' };

export interface DestinationContext {
  /** This window's workspace and its repository; null on the home screen. */
  current: WorkspaceOnRepository | null;
  workspaces: readonly WorkspaceOnRepository[];
  /** The workspaces the windows show, the last focused one's first (`windows.shownWorkspaces`). */
  shown: readonly string[];
  /** The recently used workspaces, the latest first (`recentWorkspacePaths`). */
  recent: readonly string[];
}

export function linkDestination(link: { server: string; repository: string }, { current, workspaces, shown, recent }: DestinationContext): LinkDestination {
  const isOnRepository = (workspace: WorkspaceOnRepository): boolean => workspace.repository !== null && isRepository(workspace.repository, link);
  if (current && isOnRepository(current)) return { kind: 'here' };
  const onRepository = workspaces.filter(isOnRepository).map((workspace) => workspace.path);
  const shownOne = shown.find((path) => onRepository.includes(path));
  if (shownOne) return { kind: 'workspace', path: shownOne };
  if (onRepository.length === 1) return { kind: 'workspace', path: onRepository[0]! };
  if (onRepository.length === 0) return { kind: 'none' };
  return { kind: 'pick', paths: byRecentUse(onRepository, recent) };
}

/**
 * Whether a repository spec (`game@acme@unity`) is the one a link names: the same name, in any case as `cm` takes it,
 * on the same server, whatever protocol either writes it with (`sameServer`).
 */
export function isRepository(repositorySpec: string, link: { server: string; repository: string }): boolean {
  const { name, server } = splitRepositorySpec(repositorySpec);
  return name.toLowerCase() === link.repository.toLowerCase() && sameServer(server, link.server);
}

/** The most recently used first, then the others in their own order. */
function byRecentUse(paths: readonly string[], recent: readonly string[]): string[] {
  const rank = (path: string): number => {
    const index = recent.indexOf(path);
    return index === -1 ? recent.length : index;
  };
  return [...paths].sort((a, b) => rank(a) - rank(b));
}
