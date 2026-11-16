import type { Branch } from '@shared/domain/branch';
import type { BranchGroup } from '../branches/branchSearchRows';
import { newestBranchesFirst } from '../branches/newestBranchesFirst';

/**
 * A branch's ancestors, nearest first, from its name alone: a child branch's name holds its parents'
 * (`/main/release/task` → `/main/release`, `/main`), so no read is needed. None for a top-level branch.
 */
export function ancestorsOf(branchName: string): string[] {
  const parts = branchName.split('/').filter(Boolean);
  return parts.slice(0, -1).map((_, index) => `/${parts.slice(0, parts.length - 1 - index).join('/')}`);
}

/**
 * Where a merge request of `source` can merge, for the destination pickers (`DestinationPicker`, the new merge
 * request's Into): the source's ancestors first, nearest first, where it usually goes; a top-level branch's, whose name
 * holds none, is its parent (`sourceParent`, where known). Then every other branch, newest first, to find by typing.
 * Never the source itself, nor a branch made from it (`/main/task/sub` for `/main/task`), which can't take it back
 * (`draftProblem` still refuses one, the guard).
 */
export function destinationGroups(branches: readonly Branch[], source: string, sourceParent?: string): BranchGroup[] {
  const byName = new Map(branches.map((branch) => [branch.name, branch]));
  const named = ancestorsOf(source);
  const ancestorNames = named.length === 0 && sourceParent ? [sourceParent] : named;
  const ancestors = ancestorNames.flatMap((name) => byName.get(name) ?? []);
  const shown = new Set([source, ...ancestorNames]);
  const others = newestBranchesFirst(branches).filter((branch) => !shown.has(branch.name) && !branch.name.startsWith(`${source}/`));
  return [
    { title: 'Ancestors', branches: ancestors },
    { title: 'Other branches', branches: others },
  ];
}
