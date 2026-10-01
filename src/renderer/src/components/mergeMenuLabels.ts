import { branchLabel } from '../lib/branchLabels';

/**
 * The two kinds of merge in menus, told apart by where the result goes: into the workspace (a preview to check in), or
 * straight to a branch on the server, the workspace untouched. Side by side they must never read as the same action.
 */
export const MERGE_INTO_WORKSPACE = 'Merge into this workspace';

/** The most characters of the destination's name in a menu item, so "on the server…" still fits a menu's width. */
const MENU_BRANCH_CHARS = 20;

/** A merge on the server into `destination` (named by its own name, `branchLabel`), or into a branch picked next. */
export function serverMergeLabel(destination?: string): string {
  return `Merge to ${destination ? branchLabel(destination, MENU_BRANCH_CHARS) : 'another branch'} on the server…`;
}
