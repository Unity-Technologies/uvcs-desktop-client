/**
 * The first `cm` with `cm branch editcomment`. An older one doesn't fail on it: `cm branch` takes a subcommand it
 * doesn't know as the name of a branch to create, so saving a comment would create a branch called `editcomment`.
 */
const FIRST_CM_EDITING_BRANCH_COMMENTS = [11, 0, 16, 10512];

/**
 * Whether this `cm` (its version as `cm version` prints it) can edit a branch's comment. A version it can't read
 * answers no: the edit is offered only where it can't create a branch instead.
 */
export function editsBranchComments(cmVersion: string | undefined): boolean {
  const parts = cmVersion?.trim().split('.') ?? [];
  if (parts.length !== FIRST_CM_EDITING_BRANCH_COMMENTS.length || !parts.every((part) => /^\d+$/.test(part))) return false;
  for (const [index, first] of FIRST_CM_EDITING_BRANCH_COMMENTS.entries()) {
    const part = Number(parts[index]);
    if (part !== first) return part > first;
  }
  return true;
}
