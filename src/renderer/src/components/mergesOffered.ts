import { workspacePathOf, type Place } from '@shared/domain/place';
import type { WorkspaceKind } from '@shared/domain/workspace';

/**
 * Where a menu of the server's objects (branches, changesets, labels) shows: the window's place, and how its
 * workspace holds its files, which decides whether merges are offered (`offersMerges`).
 */
export interface MenuPlace {
  place: Place;
  /** The workspace's kind (`WorkspaceInfo.kind`); undefined while it's read, when `cm` didn't tell, or with no workspace. */
  workspaceKind: WorkspaceKind | undefined;
}

/**
 * Whether merges are offered here: into the workspace (merge, cherry pick, subtractive), and from it to a branch on
 * the server (Merge to…, finishing a task). Only a workspace starts them: a repository explored without one has none.
 * A partial workspace offers none at all. `cm` refuses to merge into it; a merge on the server would run, since it
 * never touches the workspace, but merging is work on the whole branch, done from a workspace that holds it: Download
 * the whole branch… makes a partial workspace standard first (`downloadsWholeBranch`). A kind not known yet offers
 * them, as a standard or dynamic workspace does.
 */
export function offersMerges({ place, workspaceKind }: MenuPlace): boolean {
  return workspacePathOf(place) !== null && workspaceKind !== 'partial';
}
