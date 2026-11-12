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
