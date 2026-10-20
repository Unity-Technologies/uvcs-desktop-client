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

/** Where the branches a list shows stand: still read, couldn't be read, or read (kept when a later read fails). */
export type BranchesRead = 'loading' | 'failed' | 'read';

export function branchesRead({ data, isError }: { data: unknown; isError: boolean }): BranchesRead {
  if (data !== undefined) return 'read';
  return isError ? 'failed' : 'loading';
}

/** What the branch list says when it shows no branch; null while the branches are still read. */
export function branchSearchEmptyText(query: string, read: BranchesRead): string | null {
  if (read === 'loading') return null;
  if (read === 'failed') return "Couldn't read the branches.";
  return query.trim() ? `No branches match “${query}”.` : 'No branches.';
}
