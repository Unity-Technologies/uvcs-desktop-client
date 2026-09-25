import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReview } from '@shared/domain/codeReview';
import type { MergePlan } from '@shared/domain/merge';
import { firstLine, pluralize } from '../../lib/text';

export type MergeTaskOutcome =
  | { kind: 'clean' }
  | { kind: 'conflicts'; description: string }
  | { kind: 'alreadyMerged' }
  | { kind: 'invalid' };

/** What finishing the task would do, from the preview of the server-side merge. */
export function mergeTaskOutcome(plan: MergePlan): MergeTaskOutcome {
  if (plan.status === 'alreadyMerged') return { kind: 'alreadyMerged' };
  if (plan.status !== 'ready') return { kind: 'invalid' };
  const files = plan.fileConflicts.length;
  const directories = plan.directoryConflicts.length;
  if (files + directories === 0) return { kind: 'clean' };
  return { kind: 'conflicts', description: describeConflicts(files, directories) };
}

/** "3 files conflict." / "1 file and 2 directory changes conflict." */
export function describeConflicts(files: number, directories: number): string {
  const parts = [
    files > 0 && pluralize(files, 'file'),
    directories > 0 && pluralize(directories, 'directory change'),
  ].filter(Boolean);
  const verb = files + directories === 1 ? 'conflicts' : 'conflict';
  return `${parts.join(' and ')} ${verb}.`;
}

/** "No conflicts — 5 changesets, 12 files will merge into /main." (the changesets while they are being counted). */
export function cleanSummary(changesetCount: number | undefined, fileCount: number, destination: string): string {
  const what = [changesetCount !== undefined && pluralize(changesetCount, 'changeset'), pluralize(fileCount, 'file')].filter(Boolean).join(', ');
  return `No conflicts — ${what} will merge into ${destination}.`;
}

/**
 * The changesets of the source branch the merge brings: all of them, or those after the base when the branch
 * was merged before (the base is then one of its own changesets).
 */
export function countChangesetsToMerge(branchChangesets: readonly Changeset[], plan: MergePlan, sourceBranch: string): number {
  const base = plan.contributors?.base;
  const after = base?.branch === sourceBranch ? base.changesetId : -1;
  return branchChangesets.filter((changeset) => changeset.id > after).length;
}

/** "Merge /main/t1: Add the login screen", or just "Merge /main/t1" when the branch has no comment. */
export function defaultMergeComment(branch: Pick<Branch, 'name' | 'comment'>): string {
  const summary = firstLine(branch.comment);
  return summary ? `Merge ${branch.name}: ${summary}` : `Merge ${branch.name}`;
}

/** Whether the merge can also mark the branch's review as reviewed: there is one, and it isn't yet. */
export function canMarkReviewed(review: CodeReview | undefined): review is CodeReview {
  return review !== undefined && review.status !== 'Reviewed';
}

/** Whether the destination got new changesets between two previews of the same merge. */
export function destinationMoved(reviewed: MergePlan, fresh: MergePlan): boolean {
  return reviewed.contributors?.destination.changesetId !== fresh.contributors?.destination.changesetId;
}

/** Whether a branch looks like a task branch that can be finished by merging it to its parent. */
export function isTaskBranch(branch: Pick<Branch, 'parent'> | undefined): branch is Branch {
  return Boolean(branch?.parent);
}
