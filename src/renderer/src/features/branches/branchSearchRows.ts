import type { Branch } from '@shared/domain/branch';
import { matchesAllWords } from '../../lib/matchesAllWords';

export interface BranchGroup {
  title: string;
  branches: Branch[];
}

/** A line of the branch list: a group title, or a branch with its position among the branches (for the keyboard highlight). */
export type BranchSearchRow = { type: 'group'; title: string } | { type: 'branch'; branch: Branch; index: number };

/** The groups' rows, keeping the branches whose name or comment contains every word of the query. Empty groups are left out. */
export function branchSearchRows(groups: BranchGroup[], query: string): { rows: BranchSearchRow[]; branches: Branch[] } {
  const rows: BranchSearchRow[] = [];
  const branches: Branch[] = [];
  for (const group of groups) {
    const matching = query.trim()
      ? group.branches.filter((branch) => matchesAllWords(`${branch.name}\n${branch.comment}`, query))
      : group.branches;
    if (matching.length === 0) continue;
    rows.push({ type: 'group', title: group.title });
    for (const branch of matching) {
      rows.push({ type: 'branch', branch, index: branches.length });
      branches.push(branch);
    }
  }
  return { rows, branches };
}
