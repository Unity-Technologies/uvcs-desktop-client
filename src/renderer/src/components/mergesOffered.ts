import { workspacePathOf, type Place } from '@shared/domain/place';
import type { WorkspaceKind } from '@shared/domain/workspace';

/**
 * Where a menu of the server's objects (branches, changesets, labels) shows: the window's place, and how its
 * workspace holds its files, which decides which merges are offered (`offersMerges`, `offersServerMerges`).
 */
export interface MenuPlace {
  place: Place;
  /** The workspace's kind (`WorkspaceInfo.kind`); undefined while it's read, when `cm` didn't tell, or with no workspace. */
  workspaceKind: WorkspaceKind | undefined;
}

/**
 * Whether merges into the workspace are offered (merge, cherry pick, subtractive). Only a workspace takes them: a
 * repository explored without one has none, and neither has a partial workspace, which `cm` refuses to merge into.
 * Download the whole branch… makes a partial workspace standard first (`downloadsWholeBranch`). A kind not known yet
 * offers them, as a standard or dynamic workspace does.
 */
export function offersMerges({ place, workspaceKind }: MenuPlace): boolean {
  return offersServerMerges({ place, workspaceKind }) && workspaceKind !== 'partial';
}

/**
 * Whether merges on the server are offered: Merge to…, finishing a task. They never touch the workspace, so a
 * partial one offers them too; the merge page runs in a workspace, so a repository explored without one has none.
 */
export function offersServerMerges({ place }: MenuPlace): boolean {
  return workspacePathOf(place) !== null;
}
