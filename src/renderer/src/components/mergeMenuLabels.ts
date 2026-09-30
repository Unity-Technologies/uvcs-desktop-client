/**
 * The two kinds of merge in menus, told apart by where the result goes: into the workspace (a preview to check in), or
 * straight to a branch on the server, the workspace untouched. Side by side they must never read as the same action.
 */
export const MERGE_INTO_WORKSPACE = 'Merge into this workspace';

/** A merge on the server into `destination`, or into a branch picked next. */
export function serverMergeLabel(destination?: string): string {
  return `Merge to ${destination ?? 'another branch'} on the server…`;
}
