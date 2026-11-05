import type { BranchStart } from '@shared/domain/branch';
import type { ChangesetInfo } from '@shared/domain/changeset';

/**
 * Where "Open branch diff up to this changeset" diffs from: the branch's work up to a changeset, before what it merged
 * from its parent later (a "rebase"), from where the branch starts (`BranchStart.base`, which no merge moves).
 *
 * - `none`: not offered. A top-level branch (/main) starts from no other branch, and on a branch's first changeset it
 *   would be that changeset's own diff, "Open diff".
 * - `from`: offered, from a base already known (the Branch Explorer's history has it: `branchStartInGraph`).
 * - `unknown`: offered, and the base is read when it is chosen (`ChangesetsApi.branchStart`). The lists don't know a
 *   branch's first changeset, and reading it to build every menu would cost the server a command per right-click.
 */
export type BranchDiffBase = { kind: 'none' } | { kind: 'from'; base: number } | { kind: 'unknown' };

const NONE: BranchDiffBase = { kind: 'none' };

/** Whether to offer the branch diff up to `changeset`, and from where; `start` is where its branch starts, when known. */
export function branchDiffBase(changeset: Pick<ChangesetInfo, 'id' | 'branch'>, start: BranchStart | null): BranchDiffBase {
  if (isTopLevelBranch(changeset.branch)) return NONE;
  if (start === null) return { kind: 'unknown' };
  if (start.base < 0 || changeset.id <= start.firstChangeset) return NONE;
  return { kind: 'from', base: start.base };
}

/**
 * The base of a branch whose start was read once the entry was chosen: none when the branch has no changesets or
 * starts nowhere (/main). Chosen on its first changeset, which a list can't tell, it opens that changeset's own changes.
 */
export function baseOfStart(start: BranchStart | null): number | null {
  return start !== null && start.base >= 0 ? start.base : null;
}

/** `/main`, `/release`: a branch with no parent branch. */
function isTopLevelBranch(name: string): boolean {
  return name.lastIndexOf('/') === 0;
}
