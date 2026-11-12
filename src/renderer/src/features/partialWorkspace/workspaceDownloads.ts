import type { WorkspaceKind, WorkspaceSelector } from '@shared/domain/workspace';

/**
 * Whether a workspace may choose what it downloads: a partial one always; a standard one on a branch too, since the
 * first choice applied (`cm partial configure`) makes it partial, and a partial workspace only works on a branch. A
 * dynamic workspace downloads files as they're opened, and an unknown kind or selector may be either.
 */
export function choosesDownloads(kind: WorkspaceKind | undefined, selector: WorkspaceSelector | undefined): boolean {
  if (kind === 'partial') return true;
  return kind === 'standard' && selector?.kind === 'branch';
}

/**
 * What choosing changes for a standard workspace, in the words of the new workspace's "What to download" cards
 * (`downloadCards`); null when the workspace is already partial.
 */
export function chooseDownloadsNote(kind: WorkspaceKind | undefined): string | null {
  if (kind !== 'standard') return null;
  return 'Applying makes this a partial workspace: only the folders you pick are downloaded, each file updates on its own, and merging needs the whole branch.';
}

/** What Files' menu knows of an item when it decides whether to offer choosing what to download on it. */
export interface DownloadsItem {
  isPrivate: boolean;
  /** Added and not checked in yet: the server's tree, which the dialog shows, doesn't hold it. */
  added: boolean;
  /** The item's repository, `name@server`, when the listing gives it. */
  repository?: string;
}

/**
 * Whether Files' menu offers Choose what to download on an item: one of the workspace's own repository that the
 * server's tree holds, in a workspace that may choose (`choosesDownloads`). Not a private or added item, which the
 * dialog's tree doesn't show, nor one under an xlink: an xlink downloads whole, and its folders aren't chosen.
 */
export function choosesDownloadsFor(
  item: DownloadsItem,
  where: { underXlink: boolean; workspaceRepository: string | undefined },
  kind: WorkspaceKind | undefined,
  selector: WorkspaceSelector | undefined,
): boolean {
  if (!choosesDownloads(kind, selector)) return false;
  if (item.isPrivate || item.added || where.underXlink) return false;
  return !(where.workspaceRepository && item.repository && item.repository !== where.workspaceRepository);
}
