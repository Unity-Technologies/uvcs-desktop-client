import type { Branch } from '@shared/domain/branch';

/** When a branch was created, in milliseconds: its date read as a moment (offsets differ across a change of time), 0 if unreadable. */
export function branchCreatedTime(branch: Pick<Branch, 'date'>): number {
  return Date.parse(branch.date) || 0;
}

/** The branches, the newest first by creation, each date read once. */
export function newestBranchesFirst<T extends Pick<Branch, 'date'>>(branches: readonly T[]): T[] {
  return branches
    .map((branch) => ({ branch, created: branchCreatedTime(branch) }))
    .sort((a, b) => b.created - a.created)
    .map(({ branch }) => branch);
}
