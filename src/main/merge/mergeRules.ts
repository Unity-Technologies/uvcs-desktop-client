import { hasMergeBase, isValidRenameName, RENAMEABLE_CONFLICTS, type DirectoryDecision, type MergePlan, type MergeResolutions } from '@shared/domain/merge';

const UNMERGEABLE_REASONS: Record<Exclude<MergePlan['status'], 'ready'>, string> = {
  pendingChanges: 'The workspace has pending changes. Check them in or shelve them before merging.',
  alreadyMerged: 'There is nothing to merge: the destination already has these changes.',
  invalidInterval: 'The changeset interval is not valid.',
};

/** Why a merge cannot run, or null when it can. */
export function describeUnmergeablePlan(plan: MergePlan): string | null {
  return plan.status === 'ready' ? null : UNMERGEABLE_REASONS[plan.status];
}

/** Refuses to merge unless every conflict has a valid decision, so no file is left half-merged. */
export function assertResolutionsComplete(plan: MergePlan, resolutions: MergeResolutions): void {
  // Directory decisions are applied as they're made (`DirectoryDecisions`): a conflict left is one without.
  if (plan.directoryConflicts.length > 0) throw new Error('Every directory conflict needs a decision before merging.');

  const unresolved = plan.fileConflicts.filter((conflict) => !resolutions.files[conflict.path]);
  if (unresolved.length > 0) throw new Error(`Resolve ${unresolved.map((conflict) => conflict.path).join(', ')} before merging.`);
  const baseless = plan.fileConflicts.find((conflict) => resolutions.files[conflict.path]!.choice === 'base' && !hasMergeBase(conflict));
  if (baseless) throw new Error(`${baseless.path} has no base to keep: it was added on both sides.`);
}

/** Refuses keeping both items where the conflict holds one, or under a name that isn't one (`isValidRenameName`). */
export function assertDecisionValid({ conflict, resolution }: DirectoryDecision): void {
  if (resolution.choice !== 'rename') return;
  if (!RENAMEABLE_CONFLICTS.has(conflict.type)) throw new Error(`${conflict.title}: keeping both items is not possible.`);
  if (!isValidRenameName(resolution.newName)) throw new Error(`“${resolution.newName}” is not a valid name.`);
}
