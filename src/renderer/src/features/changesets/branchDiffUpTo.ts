import type { BranchStart } from '@shared/domain/branch';
import type { ChangesetInfo } from '@shared/domain/changeset';

/**
 * Where "Open branch diff up to this changeset" diffs from: the branch's work up to a changeset, before what it merged
 * from its parent later (a "rebase"), from where the branch starts (`BranchStart.base`, which no merge moves).
 *
 * - `none`: not offered. A root branch (/main) starts from no other, and on a branch's first changeset it would be
 *   that changeset's own diff, "Open diff".
 * - `from`: offered, from a base already known (the Branch Explorer's history has it: `branchStartInGraph`).
 * - `unknown`: offered, and the start is read when it is chosen (`ChangesetsApi.branchStart`, `readStartOutcome`).
 *   The lists don't know a branch's first changeset, and reading it to build every menu would cost the server a
 *   command per right-click. A top-level branch is offered too: the app creates them from a changeset or a label
 *   ("Top-level branch" in New branch), so only /main is known by its name to start from no other.
 */
export type BranchDiffBase = { kind: 'none' } | { kind: 'from'; base: number } | { kind: 'unknown' };

const NONE: BranchDiffBase = { kind: 'none' };

/** The root branch every repository has, which starts from no other. */
const ROOT_BRANCH = '/main';

/** Whether to offer the branch diff up to `changeset`, and from where; `start` is where its branch starts, when known. */
export function branchDiffBase(changeset: Pick<ChangesetInfo, 'id' | 'branch'>, start: BranchStart | null): BranchDiffBase {
  if (start === null) return changeset.branch === ROOT_BRANCH ? NONE : { kind: 'unknown' };
  if (start.base < 0 || changeset.id <= start.firstChangeset) return NONE;
  return { kind: 'from', base: start.base };
}

/**
 * What the start read once the entry was chosen leads to: the diff from its base; a root branch, which starts from no
 * other (`base` -1); or none read, a branch with no changesets. Chosen on a branch's first changeset, which a list
 * can't tell, the diff is that changeset's own changes.
 */
export type ReadStartOutcome = { kind: 'from'; base: number } | { kind: 'root' } | { kind: 'empty' };

export function readStartOutcome(start: BranchStart | null): ReadStartOutcome {
  if (start === null) return { kind: 'empty' };
  return start.base >= 0 ? { kind: 'from', base: start.base } : { kind: 'root' };
}
